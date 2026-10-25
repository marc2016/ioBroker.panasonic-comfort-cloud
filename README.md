# ioBroker.panasonic-comfort-cloud

**⚠️ IMPORTANT: This adapter is for Air Conditioners only. It does NOT support Heat Pumps (Wärmepumpen).**

![Logo](admin/panasonic-comfort-cloud.png)

![Number of Installations](http://iobroker.live/badges/panasonic-comfort-cloud-installed.svg) ![Number of Installations](http://iobroker.live/badges/panasonic-comfort-cloud-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.panasonic-comfort-cloud.svg)](https://www.npmjs.com/package/iobroker.panasonic-comfort-cloud)
[![Downloads](https://img.shields.io/npm/dm/iobroker.panasonic-comfort-cloud.svg)](https://www.npmjs.com/package/iobroker.panasonic-comfort-cloud)
[![Tests and release](https://github.com//marc2016/ioBroker.panasonic-comfort-cloud/actions/workflows/test-and-release.yml/badge.svg)](https://www.npmjs.com/package/iobroker.panasonic-comfort-cloud)

[![Known Vulnerabilities](https://snyk.io/test/github/marc2016/ioBroker.panasonic-comfort-cloud/badge.svg)](https://snyk.io/test/github/marc2016/ioBroker.panasonic-comfort-cloud)

[![NPM](https://nodei.co/npm/iobroker.panasonic-comfort-cloud.png?downloads=true)](https://nodei.co/npm/iobroker.panasonic-comfort-cloud/)

## panasonic-comfort-cloud adapter for ioBroker

Adapter to control devices in the Panasonic Comfort Cloud. It uses REST calls which are extracetd from the official Comfort Cloud app.
To use the a adpter you need to enter your username and password in the configuration. They are used to authenticate access to the Comfort Cloud. Information of all devices is automatically retrieved and inserted as an object. The adpter polls the device information cyclically (see interval in the settings) and sends commands directly to the cloud.

With the method used, only one client can be logged on with the account at a time.
It is recommended that a second account, for which the devices have been shared, is used.

## Configuration
1.  **Username**: Your Panasonic Comfort Cloud username (email).
2.  **Password**: Your Panasonic Comfort Cloud password.
3.  **Refresh Interval**: Time in minutes between updates from the cloud.
4.  **Automatic Refresh Enabled**: Enable/Disable automatic refreshing of device states.
5.  **Use App Version from App Store**: Automatically fetch the latest app version from the App Store (recommended).
6.  **App Version**: Manually specify the app version (if "Use App Version from App Store" is disabled).
7.  **History Enabled**: Enable fetching of energy consumption history (Day/Month).

## Object Structure
The adapter creates a hierarchy based on your Panasonic account structure:
`panasonic-comfort-cloud.0.GroupId.DeviceId.StateId`

## Usage Examples

### Controlling a Device (JavaScript)
You can control your devices using simple `setState` commands in scripts.

```javascript
/*
 * Example: Controlling a Panasonic AC
 * Replace 'YOUR_GROUP_ID' and 'YOUR_DEVICE_ID' with your actual IDs.
 */

const devicePath = 'panasonic-comfort-cloud.0.YOUR_GROUP_ID.YOUR_DEVICE_ID';

// Turn on the air conditioner
setState(`${devicePath}.operate`, 1); // 1 = On, 0 = Off

// Set target temperature to 22°C
setState(`${devicePath}.temperatureSet`, 22);

// Set operation mode to Cool
// 0=Auto, 1=Dry, 2=Cool, 3=Heat, 4=Fan
setState(`${devicePath}.operationMode`, 2);

// Set fan speed to Auto
// 0=Auto, 1=Low, 2=LowMid, 3=Mid, 4=HighMid, 5=High
setState(`${devicePath}.fanSpeed`, 0);

// Enable Eco Mode
// 0=Auto, 1=Powerful, 2=Quiet
setState(`${devicePath}.ecoMode`, 2);
```

### Reading Sensor Data
Access read-only states to get current environmental data.

```javascript
const devicePath = 'panasonic-comfort-cloud.0.YOUR_GROUP_ID.YOUR_DEVICE_ID';

// Log current temperatures
const insideTemp = getState(`${devicePath}.insideTemperature`).val;
const outsideTemp = getState(`${devicePath}.outTemperature`).val;

console.log(`Inside: ${insideTemp}°C, Outside: ${outsideTemp}°C`);
```

### Accessing History Data
If `History Enabled` is active, you can access energy consumption and temperature logs.
*   **Day Mode**: `history.day.00` to `history.day.24` (Hours 00:00 to 24:00)
*   **Month Mode**: `history.month.01` to `history.month.31` (Days 1 to 31)

```javascript
// Example: Get energy consumption for 12:00 PM (Day Mode)
const hour12 = getState('panasonic-comfort-cloud.0.YOUR_GROUP_ID.YOUR_DEVICE_ID.history.day.12.consumption').val;
console.log(`Accumulated consumption at 12:00: ${hour12} kWh`);

// Example: Get average outside temperature for the 15th of the month
const day15Temp = getState('panasonic-comfort-cloud.0.YOUR_GROUP_ID.YOUR_DEVICE_ID.history.month.15.averageOutsideTemp').val;
console.log(`Avg Outside Temp on the 15th: ${day15Temp}°C`);
```

## Changelog
<!--
  Placeholder for the next version (at the beginning of the line):
  ### **WORK IN PROGRESS**
-->
### 3.5.0 (2026-10-25)

* fixed login error 4106 "New version app has been published": the app version is now sent together with the matching platform; versions are read from Google Play and the App Store and tried in turn (#141)
* added settings for the Google Play version and the platform of a manually configured app version
* the adapter restarts itself once when a new app version is published while it is running
* updated panasonic-comfort-cloud-client to 3.0.0 (stops token refresh on unload, clearer login errors, fixes `npm ci` with npm 10)
* raised minimum Node.js version to 22.12

### 3.4.1 (2026-10-25)

* fixed password being encrypted twice when a new App Store version was detected, which caused login error 401 (#140). If you were affected, please enter your password again once in the instance settings
* updated release-script and plugins to 5.2.0
* raised minimum Node.js version to 22
* migrated to @iobroker/eslint-config (ESLint 9)
* updated admin dependency to 7.6.20
* fixed button roles for manualRefresh and refreshHistory (read=false)
* removed unused dependencies (ts-enum-util, undici)
* fixed i18n translations (historyEnabled, removed outdated keys)
* added Dependabot and auto-merge configuration
* updated CI workflow (Node 22/24, drop Node 20)
* moved older changelog entries to CHANGELOG_OLD.md
* removed obsolete .travis.yml and admin/style.css
* replaced setTimeout with adapter this.setTimeout/this.clearTimeout

### 3.4.0 (2025-12-30)
* fixed history.current updates by using latest available data (handle API lag)
* increased history refresh rate to 15min
* improved history.current timestamp to show harvest time (minute precision)
* added history.lastHour to show values of the previously completed hour

### 3.3.0 (2025-12-27)
* fixed unit tests for history states
* fix eslint errors in test files
* improve documentation (configuration, examples)
* update dependencies and repository configuration
* fix CI issues
* cleanup devDependencies
* add history.current channel
* ensure correct roles for history objects
* fix history date format for current history
* fix undefined state value in history
* fix current history logic

### 3.2.2 (2025-12-21)
* re-enable history data fetching (month mode)
* implement improved history date format (YYYY-MM-DD HH:mm:ss)

Older changelog entries are available in [CHANGELOG_OLD.md](CHANGELOG_OLD.md).

## License

MIT License

Copyright (c) 2025-2026 marc <marc@lammers.dev>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
