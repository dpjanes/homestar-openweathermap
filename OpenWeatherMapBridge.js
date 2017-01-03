/*
 *  OpenWeatherMapBridge.js
 *
 *  David Janes
 *  IOTDB.org
 *  2016-02-10
 *
 *  Copyright [2013-2016] [David P. Janes]
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

const iotdb = require('iotdb');
const _ = iotdb._;

const assert = require("assert");
const unirest = require("unirest");
const cjson = require("canonical-json");

const logger = iotdb.logger({
    name: 'homestar-openweathermap',
    module: 'OpenWeatherMapBridge',
});

// global
const urld = {};

/**
 *  See {iotdb.bridge.Bridge#Bridge} for documentation.
 *  <p>
 *  @param {object|undefined} native
 *  only used for instances, should be 
 */
const OpenWeatherMapBridge = function (initd, native) {
    const self = this;

    self.initd = _.defaults(initd,
        iotdb.keystore().get("bridges/OpenWeatherMapBridge/initd"), {
            poll: 10 * 60,
            location: null,
            id: null,
            name: null,
        }
    );

    self.native = native;   
    self.hashd = {}

    assert.ok(!_.is.Empty(self.initd.location), "initd.location is required");
    assert.ok(!_.is.Empty(self.initd.key), "initd.key is required");
    assert.ok([ "observation", "forecast" ].indexOf(self.initd.retrieve) !== -1, "initd.retrieve must be 'observation' or 'forecast'");
};

OpenWeatherMapBridge.prototype = new iotdb.Bridge();

/* --- lifecycle --- */

/**
 *  See {iotdb.bridge.Bridge#discover} for documentation.
 */
OpenWeatherMapBridge.prototype.discover = function () {
    const self = this;

    logger.info({
        method: "discover"
    }, "called");

    let found = false;
    const _try = () => {
        self._fetch((itemd, hash_key) => {
            if (!hash_key) {
                return;
            }

            self.discovered(new OpenWeatherMapBridge(self.initd, {
                id: itemd.id,
                name: itemd.name,
                hash_key: hash_key,
            }));
        })
    }

    _try()

    const timerId = setInterval(_try, self.initd.poll * 1000);
};

/**
 *  See {iotdb.bridge.Bridge#connect} for documentation.
 */
OpenWeatherMapBridge.prototype.connect = function (connectd) {
    const self = this;
    if (!self.native) {
        return;
    }

    self._validate_connect(connectd);

    self._setup_polling();
    self.pull();
};

OpenWeatherMapBridge.prototype._setup_polling = function () {
    const self = this;
    if (!self.initd.poll) {
        return;
    }

    var timer = setInterval(function () {
        if (!self.native) {
            clearInterval(timer);
            return;
        }

        self.pull();
    }, self.initd.poll * 1000);
};

OpenWeatherMapBridge.prototype._forget = function () {
    const self = this;
    if (!self.native) {
        return;
    }

    logger.info({
        method: "_forget"
    }, "called");

    self.native = null;
    self.pulled();
};

/**
 *  See {iotdb.bridge.Bridge#disconnect} for documentation.
 */
OpenWeatherMapBridge.prototype.disconnect = function () {
    const self = this;
    if (!self.native || !self.native) {
        return;
    }

    self._forget();
};

/* --- data --- */

/**
 *  See {iotdb.bridge.Bridge#push} for documentation.
 */
OpenWeatherMapBridge.prototype.push = function (pushd, done) {
    const self = this;
    if (!self.native) {
        done(new Error("not connected"));
        return;
    }

    self._validate_push(pushd, done);

    logger.info({
        method: "push",
        pushd: pushd
    }, "push");
};

/**
 *  See {iotdb.bridge.Bridge#pull} for documentation.
 */
OpenWeatherMapBridge.prototype.pull = function () {
    const self = this;
    if (!self.native) {
        return;
    }

    self._fetch((pulld, new_key) => self.pulled(pulld));
};

OpenWeatherMapBridge.prototype._cook = function (ind) {
    const _k2c = value => {
        if (_.is.Null(value)) {
            return null
        }

        return _.convert.convert({
            value: value,
            from: 'iot-unit:temperature.si.kelvin',
            to: 'iot-unit:temperature.si.celsius',
        });
    }

    const outd = {
        name: _.d.first(ind, "/name", null),
        id: _.d.first(ind, "/id", null),
        conditions: _.d.first(ind, "/weather/description"),

        latitude: _.d.first(ind, "/coord/lat", null),
        longitude: _.d.first(ind, "/coord/lon", null),

        temperature: _k2c(_.d.first(ind, "/main/temp", null)),
        pressure: _.d.first(ind, "/main/pressure", null),
        humidity: _.d.first(ind, "/main/humidity", null),
        temperature_minimum: _k2c(_.d.first(ind, "/main/temp_min", null)),
        temperature_maximum: _k2c(_.d.first(ind, "/main/temp_max", null)),

        visibility: _.d.first(ind, "/visibility", null),

        wind_speed: _.d.first(ind, "/wind/speed", null),
        wind_direction: _.d.first(ind, "/wind/deg", null),
    }

    const date = ind.dt_txt;
    if (date) {
        outd.when = new Date(date).toISOString();
    }

    return _.d.transform(outd, { filter: value => value !== null });
}

OpenWeatherMapBridge.prototype._fetch = function (pulled) {
    const self = this;

    if (self.initd.retrieve === "observation") {
        self._fetch_observation(pulled)
    } else if (self.initd.retrieve === "forecast") {
        self._fetch_forecast(pulled)
    } else {
        assert.ok(false, "can't get here");
    }
}

OpenWeatherMapBridge.prototype._fetch_observation = function (pulled) {
    const self = this;

    const url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(self.initd.location)}&appid=${self.initd.key}`
    const hash_key = "forecast";

    self._fetch_url(url, (error, body) => {
        if (error) {
            logger.error({
                method: "_fetch_observation",
                error: result.error,
            }, "likely a network error");
            return;
        }

        const hash = _.hash.md5(cjson(body))
        const is_new = !self.hashd[hash_key];
        if (self.hashd[hash_key] === hash) {
            logger.debug({
                method: "_fetch_observation",
            }, "no change");
            return;
        }

        self.hashd[hash_key] = hash;

        pulled(self._cook(body), is_new ? hash_key : null);
    })
}

OpenWeatherMapBridge.prototype._fetch_forecast = function (pulled) {
    const self = this;

    const url = `http://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(self.initd.location)}&appid=${self.initd.key}`

    self._fetch_url(url, (error, body) => {
        if (error) {
            logger.error({
                method: "_fetch_forecast",
                error: result.error,
            }, "likely a network error");
            return;
        }

        _.d.list(body, "list", []).forEach(itemd => {
            const hash_key = new Date(itemd.dt_txt).toISOString();

            // console.log("HERE:XXX", self.native.hash_key, hash_key);
            if (self.native && self.native.hash_key && (hash_key !== self.native.hash_key)) {
                return;
            }

            const hash = _.hash.md5(cjson(itemd))
            const is_new = !self.hashd[hash_key];
            if (self.hashd[hash_key] === hash) {
                logger.debug({
                    method: "_fetch_forecast",
                }, "no change");
                return;
            }

            self.hashd[hash_key] = hash;

            pulled(self._cook(itemd), is_new ? hash_key : null);
        })
    })
}

/**
 *  This caches URLs for 60 seconds to stop quick repeats
 */
OpenWeatherMapBridge.prototype._fetch_url = function (url, done) {
    const self = this;

    const now = (new Date()).getTime();

    const removes = [];
    _.mapObject(urld, (d, url) => {
        if ((now - d.downloaded) > (60 * 1000)) {
            removes.push(url);
        }
    })

    const d = urld[url];
    if (d) {
        return done(d.error, d.body)
    }

    unirest
        .get(url)
        .end(result => {
            urld[url] = {
                downloaded: now,
                error: result.error || null,
                body: result.body || null,
            }

            return done(urld[url].error, urld[url].body)
        })
}


/* --- state --- */

/**
 *  See {iotdb.bridge.Bridge#meta} for documentation.
 */
OpenWeatherMapBridge.prototype.meta = function () {
    const self = this;
    if (!self.native) {
        return;
    }

    const metad = {
        "iot:thing-id": _.id.thing_urn.unique("OpenWeatherMap", self.initd.retrieve, self.native.id, self.native.hash_key),
        "schema:name": self.native.name || "OpenWeatherMap",
        "schema:address": self.location,
    };

    if (_.is.Timestamp(self.native.hash_key)) {
        metad["iot-purpose:when"] = self.native.hash_key
    }

    return metad;
};

/**
 *  See {iotdb.bridge.Bridge#reachable} for documentation.
 */
OpenWeatherMapBridge.prototype.reachable = function () {
    return this.native !== null;
};

/**
 *  See {iotdb.bridge.Bridge#configure} for documentation.
 */
OpenWeatherMapBridge.prototype.configure = function (app) {};

/*
 *  API
 */
exports.Bridge = OpenWeatherMapBridge;

