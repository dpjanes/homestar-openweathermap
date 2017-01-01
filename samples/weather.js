/**
 *  weather.js
 *
 *  David Janes
 *  IOTDB
 *  2017-01-01
 *
 *  Demonstrate downloading the (current) weather
 */

const iotdb = require("iotdb");
const _ = iotdb._;

const unirest = require("unirest");

const location = "Palm Springs, CA";
const key = iotdb.settings().get("/bridges/OpenWeatherMapBridge/initd/key");

const url = `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${key}`


unirest
    .get(url)
    .end(result => {
        console.log(result.body)
        
        console.log(_.d.first(result.body, "/weather/description"))
    })
