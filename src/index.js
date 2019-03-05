const utils = require('./utils');
const Promise = require('bluebird');
const archiver = require('archiver');
const decompress = require('decompress');
const { spawn } = require('child_process');
const fs = require('fs');
const Influx = require('influx')
const path = require('path');

const logger = require('debug')('influx-backup:BackupManager');

/**
 * Backup manager instance
 * @constructor
 * @param {Object} config Manager object configuration.
 * @param {String} [config.host=localhost] Host url where influxdb is running.
 * @param {Number} [config.port=8086] InfluxDB port.
 * @param {String} [config.tmp_folder=.tmp] Temporary folder path.
 * @param {String} [config.suffix=_bak] Backup database suffix.
 * @param {String} [config.retation=autogen] InfluxDB retation policy to backup.
 * @param {Number} [config.port=8088] InfluxDB backup port.
 */
function BackupManager(config){

  if (!(this instanceof BackupManager)) {
    return new BackupManager(config)
  }

  config.host = config.host || 'localhost';
  config.port = config.port || 8086;
  config.tmp_folder = config.tmp_folder || path.join(require('app-root-path').toString(), '.tmp');

  config.suffix = config.suffix || '_bak';
  config.retation = config.retation || 'autogen';
  config.backupPort = config.backupPort || 8088;

  this.config = config;
}

/**
 * Inits the backup manager, checks influxDB version and creates
 * the temprary files folder (if doesn't exists)
 */
BackupManager.prototype.init = function(){
  var self = this;
  var config = this.config;

  return new Promise((resolve, reject) => {

    var influx = self.influx = new Influx.InfluxDB({
      host: config.host,
      port: config.port,
      database: config.db,
      username: config.username,
      password: config.password,
    });

    influx.ping(5000)
    .then(hosts => {
      var local = hosts.find(h => h.url.hostname == config.host && h.url.port == config.port);

      if(!local || !local.online || !local.version){
        throw Error(`Influx DB is not running on ${config.host}:${config.port}`);
      }
      else if(require('semver').lt(local.version, '1.5.0')){
        throw Error(`Influx DB version is lower than 1.5.0`);
      }else{
        logger(`InfluxDB version: ${local.version}`)
      }
    })
    .then(() => utils.createDirectory(config.tmp_folder))
    .then(() => {

      self.inited = true;
      self.influxd = null;
      self.influxdQueue = [];

      resolve();
    })
    .catch(err => {
      logger("Error while init", err)
      reject(err);
    });
  })
}

/**
 * Creates an empty directory in temporary folder
 * @returns {Promise} a promise object with the path to the directory created
 */
BackupManager.prototype.createDir = function(){
  var self = this;
  var config = this.config;

  return new Promise((resolve, reject) => {
    var dir = path.join(config.tmp_folder, utils.guidGenerator());
    utils.createDirectory(dir)
    .then(() => resolve(dir))
    .catch(reject)
  });
}

/**
 * Deletes a directory and all its content
 * @returns {Promise.<Boolean>} a promise object that resolves if dir is correctly deleted
 */
BackupManager.prototype.deleteDir = function(path){
  return utils.removeDirectory(path);
}

/**
 * Starts a backups
 * @returns {Promise.<String>} a promise object with the path to the backup zip file
 */
BackupManager.prototype.backup = function(options){

  if(!this.inited){
    throw Error("Backup manager not inited")
  }

  var self = this;

  var config = this.config;

  if(!options) options = {};

  return new Promise((resolve, reject) => {

    var backup_dir, start, end;

    if(options.start) start = (new Date(options.start)).toISOString();
    if(options.end) end = (new Date(options.end)).toISOString();

    self.createDir()
    .then((dir) => { //spawn a process for the backup

      backup_dir = dir;

      var args = `backup -portable -database ${config.db} -host ${config.host}:${config.backupPort}`;

      //add period if valid
      if(start)
      args += ` -start ${start}`;

      if(end)
      args += ` -end ${end}`;

      args += ' ./';

      return influxd.call(self, backup_dir, args);
    })
    .then(() => {
      var zip_name;

      if(options.fileName){
        zip_name = fileName;
      }else{
        zip_name = "backup";

        if(start) zip_name += "_" + start.slice(0,10).replace(/-/g,"");

        if(end) zip_name += "_" + end.slice(0,10).replace(/-/g,"");
        else zip_name += "_" + (new Date()).toISOString().slice(0,10).replace(/-/g,"");
      }

      var download_path = `${backup_dir}/${zip_name}.zip`;

      // create a file to stream archive data to.
      var output = fs.createWriteStream(download_path);
      var archive = archiver('zip');
      archive.pipe(output);

      output.on('close', function() {
        //DONE
        logger('Influx backup created and zipped');
        resolve(download_path);
      });

      archive.on('error', function(err) {
        utils.removeDirectory(backup_dir);
        reject(err);
      });

      archive.glob('**/*', {
        cwd: backup_dir, //set the folder to run the command
        ignore: ['*.zip', '.*']
      });

      archive.finalize();
    })
    .catch((err) => {
      utils.removeDirectory(backup_dir);
      reject(err)
    })
  });
};

/**
 * Sideload a backup database to the existing database
 * @returns {Promise.<Boolean>} a promise object that resolves once the database is correctly loaded
 */
BackupManager.prototype.loadBackup = function(){

  if(!this.inited){
    throw Error("Backup manager not inited")
  }

  var config = this.config;
  var self = this;

  return new Promise((resolve, reject) => {
    var query = `SELECT * INTO ${config.db}.${config.retation}.:MEASUREMENT FROM ${config.db + config.suffix}.${config.retation}./.*/ GROUP BY *`;
    logger("Sideload DB into main DB:", query)

    // give influx 2 seconds to 'breathe'
    // fixes errors like 'shard disabled'
    // or 'engine is closed'
    setTimeout(function() {
      Promise.resolve(self.influx.query(query))
      .then(resolve)
      .catch(reject)
      .finally(() => {
        self.dropDatabase(config.db + config.suffix)
      });
    }, 2000)

  })
}

/**
 * Starts a restore
 * @param {String} restore_path The directory path of the backup zip file
 * @param {String} fileName Name of backup the zip file
 * @returns {Promise.<String>} a promise object that resolves once the influxd restore
 * restore command has load all datas in the backup database
 */
BackupManager.prototype.restore = function(restore_path, fileName){

  if(!this.inited){
    throw Error("Backup manager not inited")
  }

  var config = this.config;
  var self = this;

  //- go to backups folder
  //- delete any backup database
  //- unzip uploaded backup file
  //- restore backup to a temporary backup database
  //- remove backup files
  //- remove restore files

  return new Promise((resolve, reject) => {

    // Use promise.resolve to be able to call finally() only supported in bluebird promises
    self.dropDatabase(config.db+config.suffix)
    .then(() => Promise.resolve(decompress(path.join(restore_path, fileName), restore_path)))
    .then(files => {

      var args = `restore -portable -db ${config.db} -newdb ${config.db + config.suffix} -host ${config.host}:${config.backupPort}`;

      // add period if valid (feature not aviable yet on influx)
      // if(start) start = (new Date(start)).toISOString();
      // if(end) end = (new Date(end)).toISOString();

      // if(start)
      //   args += ` -start ${start}`;
      //
      // if(end)
      //   args += ` -end ${end}`;

      args += " ./"

      return influxd.call(self, restore_path, args)
    })
    .then(() => {
      logger('Backup restored');
      resolve();
    })
    .catch(err => {
      logger(err);
      reject(err);
    })
    .finally(() => {
      logger("Clean up backup files");
      utils.removeDirectory(restore_path);
    });

  });

};

/**
 * Creates a queue for influxd commands
 * @param {String} path The cwd path of influxd command (the directory where the command will be executed)
 * @param {Array} args Array of args to pass to the influxd command
 * @returns {Promise.<Boolean>} a promise object that resolves once the influxd command has finished
 */
function influxd(path, args){
  var self = this;

  return new Promise((resolve, reject) => {

    self.influxdQueue.push(utils.wrapFunction(spawnProcess, self, [path, args, resolve, reject]))

    // if no process is running do it
    if(!self.influxd || self.influxd.killed){
      (self.influxdQueue.shift())();
    }

    });
}

/**
 * Spawn an influxd process and calls resolve once ended
 * @param {String} path The cwd path of influxd command (the directory where the command will be executed)
 * @param {Array} args Array of args to pass to the influxd command
 * @param {Function} resolve Function to call once the command has finished
 * @param {Function} reject Function to call in case of errors
 */
function spawnProcess(path, args, resolve, reject){

  var self = this;

  var options = {
    cwd: path,
    windowsHide: true
  }

  self.influxd = spawn('influxd', args.split(' '), options);
  var err;

  logger('Influxd command started: influxd', args);

  self.influxd.stdout.on('data', (data) => {
    logger(data.toString());
  });

  self.influxd.stderr.on('data', (data) => {
    self.influxd.kill();
    err = data.toString();
  });

  self.influxd.on('error', (e) => {
    err = e;
  });

  self.influxd.on('close', (code) => {
    logger('InfluxD command DONE');
    if(code === 0)
      resolve()
    else reject(err || ("Exited with code " + code));

    // set running process to null to allow new process to start
    self.influxd = null;

    // check for waiting processes
    if(self.influxdQueue.length > 0){
      (self.influxdQueue.shift())();
    }
  });
}

/**
 * Drops an influx database (if it exists)
 * @param {String} name The database name
 * @returns {Promise.<Boolean>} A priomise object that resolves once the db is deleted correctly
 * or even if it doesn't exists
 */
BackupManager.prototype.dropDatabase = function(name){

  if(!this.inited){
    throw Error("Backup manager not inited")
  }

  var self = this;

  return new Promise(function(resolve, reject){
    self.influx.getDatabaseNames()
    .then(names => {
      if (!names.includes(name)) resolve()
      else return self.influx.query(`DROP DATABASE ${name}`)
    })
    .then(rows => {
      logger("Database", name, "dropped");
      resolve();
    }).catch(err => {
      logger(err);
      reject(err);
    });
  });
};

module.exports = BackupManager;
