# node-influxdb-backup

[![NPM version](http://img.shields.io/npm/v/node-influxdb-backup.svg)](https://www.npmjs.com/package/node-influxdb-backup)
[![Downloads](https://img.shields.io/npm/dm/node-influxdb-backup.svg)](https://www.npmjs.com/package/node-influxdb-backup)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.png?v=103)](https://opensource.org/licenses/mit-license.php)

[![NPM](https://nodei.co/npm/node-influxdb-backup.png?downloads=true)](https://nodei.co/npm/node-influxdb-backup/)

# Description

NodeJS module for InfluxDB backup/restore. This module allows to backup an InfluxDB database by creating a zip file with all backup files generated with the `influxd` shell command.

**REQUIREMENTS**
**influxd bin must be installed in your system**
**works only with InfluxDB > v1.5**

Check influx db [portable backups](https://docs.influxdata.com/influxdb/v1.7/administration/backup_and_restore/#online-backup-and-restore-for-influxdb-oss) docs for more info.

# Install

Run the following command in the root directory of your Node-RED install

    npm install node-influxdb-backup --save


# Usage

Check example on example folder
