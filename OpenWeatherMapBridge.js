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
        self._fetch(item => {
            found = true;
            clearTimeout(timer);

            self.discovered(new OpenWeatherMapBridge(self.initd, {
                id: item.id,
                name: item.name,
            }));
        })
    }

    _try()
    const timer = setInterval(_try, 30 * 1000);

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

    self._fetch(self.pulled);
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
        description: _.d.first(ind, "/weather/description"),

        latitude: _.d.first(ind, "/coord/lat", null),
        longitude: _.d.first(ind, "/coord/lon", null),

        temperature: _k2c(_.d.first(ind, "/main/temp", null)),
        pressure: _.d.first(ind, "/main/pressure", null),
        humidity: _.d.first(ind, "/main/humidity", null),
        temperature_minimum: _k2c(_.d.first(ind, "/main/temp_min", null)),
        temperature_maximum: _k2c(_.d.first(ind, "/main/temp_max", null)),

        visibility: _.d.first(ind, "/visibility", null),

        wind_speed: _.d.first(ind, "/wind/speed", null),
        wind_degrees: _.d.first(ind, "/wind/deg", null),
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

    unirest
        .get(url)
        .end(result => {
            if (result.error) {
                logger.error({
                    method: "_fetch_observation",
                    error: result.error,
                }, "likely a network error");
                return;
            }

            const hash = _.hash.md5(cjson(result.body))
            if (self.hashd["forecast"] === hash) {
                logger.debug({
                    method: "_fetch_observation",
                }, "no change");
                return;
            }

            self.hashd["forecast"] = hash;

            pulled(self._cook(result.body));
        })
}

OpenWeatherMapBridge.prototype._fetch_forecast = function (pulled) {
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

    return {
        "iot:thing-id": _.id.thing_urn.unique("OpenWeatherMap", self.initd.retrieve, self.native.id),
        "schema:name": self.native.name || "OpenWeatherMap",

        // "iot:thing-number": self.initd.number,
        // "iot:device-id": _.id.thing_urn.unique("OpenWeatherMap", self.native.uuid),
        // "schema:manufacturer": "",
        // "schema:model": "",
    };
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

