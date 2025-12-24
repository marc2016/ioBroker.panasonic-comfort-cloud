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
### **WORK IN PROGRESS**
* (marc2016) fixed unit tests for history states
* (marc2016) fix eslint errors in test files
* (marc2016) improve documentation (configuration, examples)

### 3.2.2 (2025-12-21)
* re-enable history data fetching (month mode)
* implement improved history date format (YYYY-MM-DD HH:mm:ss)

### 3.2.1 (2025-12-21)
* implement history data fetching (day mode)
* add historyEnabled configuration
* add manual history refresh command
* fix eslint errors (indentation, unused vars)

### 3.2.0 (2025-12-21)
* update library panasonic-comfort-cloud-client to 2.1.4
* modernize code (remove lodash, use async/await, split state definitions)
* replace deprecated methods with modern equivalents
* improve unit tests and remove deprecated test wrapper
* add mocked client tests to verify connection logic

### 3.1.0 (2025-08-09)

* read app version from App Store.

### 3.0.3 (2024-11-08)

* panasonic-comfort-cloud-client updated to new version. CFC generator for header added.

### 3.0.2 (2024-07-10)

* Fixed bug in refreshing oauth token again.

### 3.0.1 (2024-07-01)

* Fixed bug in refreshing oauth token.

### 3.0.0 (2024-06-29)

* Added option to deactivate the automatic refresh.
* Added state to manual refresh device infos.
* Updated client version for OAuth support.

### 2.3.0 (2023-12-21)

* Updated packages
* Added connected state to devices

### 2.2.4 (2023-10-18)

* Fixed load AppVersion from Github.

### 2.2.3 (2023-10-14)

* Added support for admin 5 UI (jsonConfig).
* Updated packages.
* Fixed translation.

### 2.2.2 (2023-09-16)

* Fixed wrong version number.

### 2.2.1 (2023-09-16)

* panasonic-comfort-cloud-client updated to new version. New headers added.

### 2.2.0

* Added feature to automatically load the app version from GitHub.

### 2.1.0

* Added app version to settings.

### 2.0.6

* panasonic-comfort-cloud-client updated to new version. (appVersion changed again)

### 2.0.5

* Translation for news added.

### 2.0.4

* New version of dependencies installed.

### 2.0.3

* panasonic-comfort-cloud-client updated to new version. (appVersion changed again)

### 2.0.2

* panasonic-comfort-cloud-client updated to new version.

### 2.0.1

* Changed the type of some states from string to number.

### 2.0.0

* Added js-controller 3 dependency.
* Added username and password to protectedNative and password to encryptedNative.
* Added connection info.
* Changed schdule to timeout for refresh.
* Fixes for async await pattern.

### 1.2.9

* Error handling for get device added.

### 1.2.8

* Fixed bug in Comfort Cloud client.

### 1.2.7

* Comfort Cloud client updated.

### 1.2.6

* Fixed bug that guid is null in device creation.

### 1.2.5

* *Comfort Cloud client updated.

### 1.2.4

* Fixed bug with undefined guid. Log messages added.

### 1.2.3

* Set parameters only for writable states.

### 1.2.2

* *Fixed error handling and added stack info.

### 1.2.1

* Fixed bug in refesh device method.

### 1.2.0

* States insideTemperature, outTemperature and Nanoe added.

## License

MIT License

Copyright (c) 2025 marc <marc@lammers.dev>

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
