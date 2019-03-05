# influx-backup

[![NPM version](http://img.shields.io/npm/v/influx-backup.svg)](https://www.npmjs.com/package/influx-backup)
[![Downloads](https://img.shields.io/npm/dm/influx-backup.svg)](https://www.npmjs.com/package/influx-backup)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.png?v=103)](https://opensource.org/licenses/mit-license.php)

[![NPM](https://nodei.co/npm/influx-backup.png?downloads=true)](https://nodei.co/npm/influx-backup/)

# Description

NodeJS module for InfluxDB backup/restore. This module allows to backup an InfluxDB database by creating a zip file with all backup files generated with the `influxd` shell command.

**REQUIREMENTS**

- `influxd` bin must be installed in your system. Check it by running `which influxd` command
- Works only with **InfluxDB > v1.5**

Uses InfluxDB portable backups introduced in InfluxDb v1.5, check [docs](https://docs.influxdata.com/influxdb/v1.7/administration/backup_and_restore/#online-backup-and-restore-for-influxdb-oss) for more info.

# Install

Run the following command in the root directory of your project

    npm install influx-backup --save


# Usage

Check [here](https://robertslando.github.io/node-influxdb-backup/) and the example in [examples](https://github.com/robertsLando/influx-backup/tree/master/examples) folder

Here are some lines from `examples/app.js`

```javascript
const TEST_DB = "testDB";

const manager = new BackupManager({db: TEST_DB});

// Restore DB api
app.post('/restore', (req, res) => {

  var restore_path = "";

  // create a temp directory to use for the backup
  manager.createDir()
  .then((dir) => {

    restore_path = dir;

    // Use multer to get the file from the req
    // and store it in the temp dir created
    var Storage = multer.diskStorage({
        destination: restore_path,
        filename: function(req, file, callback) {
            callback(null, file.originalname);
        }
    });

    // "restore" is the name attr of input file in html
    var upload = multer({storage: Storage}).single("restore");

    return multerPromise(upload, req, res)
  })
  .then((file) => {
      //now the file is stored correctly, I can start the restore command
    if(file){
        return manager.restore(restore_path, file.originalname)
    }else{
        throw Error("No file provided");
    }
}) //the backup has been restored in a backup database, load the backup in the main database
  .then(() => manager.loadBackup())
  .then(() => res.json({success:true, message: "Backup restored successfully"}))
  .catch(err => {
      console.log(err);
      res.json({success:false, message: err.message})
  });
});

// Backup DB api
app.get('/backup', (req, res) => {

  manager.backup()
  .then((file) => {
     //zip file is ready, send it to the client
    var stream = fs.createReadStream(file);

    res.setHeader('Content-disposition', 'attachment; filename=' + file.split('/').pop());

    stream.once("close", function () {
      stream.destroy(); // makesure stream closed, not close if download aborted.
      //IMPORTANT: remove backup files and zip
      manager.deleteDir(path.dirname(file));
    });

    stream.pipe(res);
  })
  .catch(err => {
    res.json({success: false, message: err});
  });

});

// Check testDB exists, if not create one and start app listening on port 8000
influx.getDatabaseNames()
.then(names => {
  if (!names.includes(TEST_DB)) {
    return influx.createDatabase(TEST_DB)
  }
})
.then(() => manager.init())
.then(() => {
  app.listen(8000, function () {
    console.log('Listening on port 8000')
  })
})
.catch(err => {
  console.error(`Error creating Influx database!`)
})

```
