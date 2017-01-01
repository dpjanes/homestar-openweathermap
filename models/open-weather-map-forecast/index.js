/*
 *  OpenWeatherMapObservation.js
 *
 *  David Janes
 *  IOTDB
 *  2016-02-10
 */

exports.binding = {
    bridge: require('../../OpenWeatherMapBridge').Bridge,
    model: require('./model.json'),
    discover: false,
    initd: {
        retrieve: "forecast",
    },
};
