# Changelog (older entries)

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
## 3.2.0 (2025-12-21)
* update library panasonic-comfort-cloud-client to 2.1.4
* modernize code (remove lodash, use async/await, split state definitions)
* replace deprecated methods with modern equivalents
* improve unit tests and remove deprecated test wrapper
* add mocked client tests to verify connection logic

## 3.1.0 (2025-08-09)

* read app version from App Store.

## 3.0.3 (2024-11-08)

* panasonic-comfort-cloud-client updated to new version. CFC generator for header added.

## 3.0.2 (2024-07-10)

* Fixed bug in refreshing oauth token again.

## 3.0.1 (2024-07-01)

* Fixed bug in refreshing oauth token.

## 3.0.0 (2024-06-29)

* Added option to deactivate the automatic refresh.
* Added state to manual refresh device infos.
* Updated client version for OAuth support.
