const path = require('path');
const fs = require('fs');
const Promise = require('bluebird');

module.exports = {
  checkFileExists(s){
    return new Promise((r, rj)=>fs.access(s, fs.F_OK, e => e ? rj(e) : r(!e)));
  },
  wrapFunction(fn, context, params) {
    return function() {
      fn.apply(context, params);
    };
  },
  guidGenerator() {
    var S4 = function() {
      return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
  },
  createDirectory(dir){
    return new Promise((resolve, reject) => {
      fs.mkdir(dir, function(err){
        if(err && err.code != 'EEXIST') reject(err);
        else resolve(null)
      });
    })
  },
  removeDirectory(dir){
    var self = this;
    return new Promise((resolve, reject) => {
      if(!fs.existsSync(dir)){
        // prevent error ENOENT
        resolve();
      }
      else{
        self.clearDirectory(dir)
        .then(() => {
          fs.rmdir(dir, function(err){
            if(err) reject(err);
            else resolve(null)
          });
        })
        .catch(err => reject(err))
      }
    })
  },
  clearDirectory(dir){
    return new Promise((resolve, reject) => {
      fs.readdir(dir, (err, files) => {
        if (err) reject(err);

        for (const file of files) {
          try {
            //ignore dot files like .gitkeep
            if(!file.startsWith('.'))
              fs.unlinkSync(path.join(dir, file))
          } catch (e) {
            reject(e);
          }
        }
        resolve();
      });
    });
  }
}
