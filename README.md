# homestar-openweathermap
IOTDB / Home☆Star Module for [OpenWeatherMap]().

<img src="https://raw.githubusercontent.com/dpjanes/iotdb-homestar/master/docs/HomeStar.png" align="right" />

NOTE THIS IS A PLACEHOLDER - if you really it, open a defect and I'll finish it up

http://openweathermap.org/api

# Installation

[Install Home☆Star first](https://homestar.io/about/install).

Then:

    $ homestar install homestar-openweathermap

# Testing

## IOTDB

Turn on OpenWeatherMap.

	$ node
	>>> iotdb = require('iotdb')
	>>> things = iotdb.connect("OpenWeatherMap")
	>>> things.set(":on", true);
	
## [IoTQL](https://github.com/dpjanes/iotdb-iotql)

Change to HDMI1 

	$ homestar install iotql
	$ homestar iotql
	> SET state:on = true WHERE meta:model-id = "openweathermap";

## Home☆Star

Do:

	$ homestar runner browser=1
	
You may have to refresh the page, as it may take a little while for your Things to be discovered. If your TV is not on it won't show up.

# Models
## OpenWeatherMap

See [OpenWeatherMap.iotql](https://github.com/dpjanes/homestar-openweathermap/blob/master/models/OpenWeatherMap.iotql)
