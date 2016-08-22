/*
 *  OpenWeatherMapObservation.js
 *
 *  David Janes
 *  IOTDB
 *  2016-02-10
 */

var iotdb = require("iotdb");

exports.binding = {
    bridge: require('../OpenWeatherMapBridge').Bridge,
    model: require('./open-weather-map-observation.json'),
};
