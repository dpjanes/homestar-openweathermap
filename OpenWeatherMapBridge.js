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

var iotdb = require('iotdb');
var _ = iotdb._;

// var openweathermap = require('openweathermap');

var logger = iotdb.logger({
    name: 'homestar-openweathermap',
    module: 'OpenWeatherMapBridge',
});

/**
 *  See {iotdb.bridge.Bridge#Bridge} for documentation.
 *  <p>
 *  @param {object|undefined} native
 *  only used for instances, should be 
 */
var OpenWeatherMapBridge = function (initd, native) {
    var self = this;

    self.initd = _.defaults(initd,
        iotdb.keystore().get("bridges/OpenWeatherMapBridge/initd"), {
            poll: 30
        }
    );
    self.native = native;   // the thing that does the work - keep this name

    if (self.native) {
        self.queue = _.queue("OpenWeatherMapBridge");
    }
};

OpenWeatherMapBridge.prototype = new iotdb.Bridge();

/* --- lifecycle --- */

/**
 *  See {iotdb.bridge.Bridge#discover} for documentation.
 */
OpenWeatherMapBridge.prototype.discover = function () {
    var self = this;

    logger.info({
        method: "discover"
    }, "called");

    /*
     *  This is the core bit of discovery. As you find new
     *  thimgs, make a new OpenWeatherMapBridge and call 'discovered'.
     *  The first argument should be self.initd, the second
     *  the thing that you do work with
     */
    var s = self._openweathermap();
    s.on('something', function (native) {
        self.discovered(new OpenWeatherMapBridge(self.initd, native));
    });
};

/**
 *  See {iotdb.bridge.Bridge#connect} for documentation.
 */
OpenWeatherMapBridge.prototype.connect = function (connectd) {
    var self = this;
    if (!self.native) {
        return;
    }

    self._validate_connect(connectd);

    self._setup_polling();
    self.pull();
};

OpenWeatherMapBridge.prototype._setup_polling = function () {
    var self = this;
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
    var self = this;
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
    var self = this;
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
    var self = this;
    if (!self.native) {
        done(new Error("not connected"));
        return;
    }

    self._validate_push(pushd, done);

    logger.info({
        method: "push",
        pushd: pushd
    }, "push");

    var qitem = {
        // if you set "id", new pushes will unqueue old pushes with the same id
        // id: self.number, 
        run: function () {
            self._pushd(pushd);
            self.queue.finished(qitem);
        },
        coda: function() {
            done();
        },
    };
    self.queue.add(qitem);
};

/**
 *  Do the work of pushing. If you don't need queueing
 *  consider just moving this up into push
 */
OpenWeatherMapBridge.prototype._push = function (pushd) {
    if (pushd.on !== undefined) {
    }
};

/**
 *  See {iotdb.bridge.Bridge#pull} for documentation.
 */
OpenWeatherMapBridge.prototype.pull = function () {
    var self = this;
    if (!self.native) {
        return;
    }
};

/* --- state --- */

/**
 *  See {iotdb.bridge.Bridge#meta} for documentation.
 */
OpenWeatherMapBridge.prototype.meta = function () {
    var self = this;
    if (!self.native) {
        return;
    }

    return {
        "iot:thing-id": _.id.thing_urn.unique("OpenWeatherMap", self.native.uuid, self.initd.number),
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

/* -- internals -- */
var __singleton;

/**
 *  If you need a singleton to access the library
 */
OpenWeatherMapBridge.prototype._openweathermap = function () {
    var self = this;

    if (!__singleton) {
        __singleton = openweathermap.init();
    }

    return __singleton;
};

/*
 *  API
 */
exports.Bridge = OpenWeatherMapBridge;
