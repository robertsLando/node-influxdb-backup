# node-influxdb-backup

[![NPM version](http://img.shields.io/npm/v/node-influxdb-backup.svg)](https://www.npmjs.com/package/node-influxdb-backup)
[![Downloads](https://img.shields.io/npm/dm/node-influxdb-backup.svg)](https://www.npmjs.com/package/node-influxdb-backup)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.png?v=103)](https://opensource.org/licenses/mit-license.php)

[![NPM](https://nodei.co/npm/node-influxdb-backup.png?downloads=true)](https://nodei.co/npm/node-influxdb-backup/)

# Description

NodeJS module for InfluxDB backup/restore. This module allows to backup an InfluxDB database by creating a zip file with all backup files generated with the `influxd` shell command.

**REQUIREMENTS**

- `influxd` bin must be installed in your system. Check it by running `which influxd` command
- Works only with **InfluxDB > v1.5**

Uses InfluxDB portable backups introduced in InfluxDb v1.5, check [docs](https://docs.influxdata.com/influxdb/v1.7/administration/backup_and_restore/#online-backup-and-restore-for-influxdb-oss) for more info.

# Install

Run the following command in the root directory of your project

    npm install node-influxdb-backup --save


# Usage

Check [here](https://robertslando.github.io/node-influxdb-backup/) and the example in [examples](https://github.com/robertsLando/node-influxdb-backup/tree/master/examples) folder.
