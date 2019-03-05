const BackupManager = require('../');
const app = require('express')();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Influx = require('influx');
const bodyParser= require('body-parser');

const TEST_DB = "testDB";

const manager = new BackupManager({db: TEST_DB});


app.use(bodyParser.urlencoded({extended: true}))

// Promisify multer
const multerPromise = function(m, req, res){
    return new Promise((resolve, reject) => {
        m(req, res, function(err) {
            if (err) reject(err);
            else resolve(req.file);
        });
    });
}

// Returns a date between last 30gg
function getRandomDate() {
    var from = Date.now() - 30*24*60*60*1000;
    var to = Date.now();
    return new Date(from + Math.random() * (to - from));
}

// Init Influx db connection
const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: TEST_DB
});

// Main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Restore DB api
app.post('/restore', (req, res) => {

  var restore_path = "";

  manager.createDir()
  .then((dir) => {

    restore_path = dir;

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
    if(file){
        return manager.restore(restore_path, file.originalname)
    }else{
        throw Error("No file provided");
    }
  })
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
    var stream = fs.createReadStream(file);

    res.setHeader('Content-disposition', 'attachment; filename=' + file.split('/').pop());

    stream.once("close", function () {
      stream.destroy(); // makesure stream closed, not close if download aborted.
      //remove backup files and zip
      manager.deleteDir(path.dirname(file));
    });

    stream.pipe(res);
  })
  .catch(err => {
    res.json({success: false, message: err});
  });

});

// Create test points
app.post('/test', (req, res) => {
  var data = [];

  for(var i=0;i<2000;i++){
    data.push({
      measurement: 'test',
      timestamp: getRandomDate(),
      fields: {value: i}
    })
  }

  influx.writePoints(data)
  .then(() => {
    console.log("Test points added");
    res.json({success: true, message: "Test points added"})
  })
  .catch(err => {
    console.error(err);
    res.json({success:false, message:err.message})
  })
})

// Get test points
app.get('/test', (req, res) => {
  influx.query(`select time, value from test`)
  .then((rows) => {
    res.json({success: true, data: rows});
  })
  .catch(err => {
    console.error(err);
    res.json({success:false, message: err.message})
  })
})

// Clear all points
app.delete('/test', (req, res) => {
  manager.dropDatabase(TEST_DB)
  .then(() => influx.createDatabase(TEST_DB))
  .then(() => {
    res.json({success: true, message: "Database cleared"});
  })
  .catch(err => {
    console.error(err);
    res.json({success:false, message: err.message})
  })
})

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
