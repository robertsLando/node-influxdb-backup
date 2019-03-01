const BackupManager = require('../');
const app = require('express')();
const multer = require('multer');

var manager = new BackupManager({db: 'testDB'});


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// It's very crucial that the file name matches the name attribute in your html
app.post('/', (req, res) => {

  manager.init()
  .then(() => manager.backup())
  .then(() => console.log("DONE"))
  .catch(console.log)

  const upload = multer({
    dest: 'uploads/' // this saves your file into a directory called "uploads"
  });
  //res.redirect('/');
});

app.listen(8000);
