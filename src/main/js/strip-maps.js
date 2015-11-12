var through = require('through2');
var path = require('path');

module.exports = function(){
    return through.obj(function(file, enc, cb){
        var extname = path.extname(file.path);
        if(extname == ".map"){
            // do nothing (i.e. drop)
            cb(null);
        }
        else {
            cb(null, file);
        }
    });
}