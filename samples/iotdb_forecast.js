/*
 *  How to use this module in IOTDB / HomeStar
 *  This is the best way to do this
 *  Note: to work, this package must have been installed by 'homestar install' 
 */

"use strict";

const iotdb = require('iotdb');
iotdb.use("homestar-openweathermap");

const things = iotdb.connect('OpenWeatherMapForecast', {
    location: "Palm Springs, CA"
});
things.on("istate", thing => {
    console.log("+", "istate", thing.thing_id(), "\n ", thing.state("istate"));
});
things.on("meta", thing => {
    console.log("+", "meta", thing.thing_id(), "\n ", thing.state("meta"));
});
things.on("thing", thing => {
    console.log("+", "discovered", thing.thing_id(), "\n ", thing.state("meta"));
});
