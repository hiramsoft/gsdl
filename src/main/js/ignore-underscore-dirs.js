var through = require('through2');
var path = require('path');
var parsePath = require('./parse-path.js');

/**
 * Synopsis: Remove files who are within a folder that begin with an underscore
 * @param options
 */
module.exports = function(options){
    return through.obj(function(file, enc, cb){
        if (file.isNull()) {
            return cb(null, file);
        }

        var parsedPath = parsePath(file.path);
        var dirnames = parsedPath.dirname.split(path.sep);
        var hasUnderscore = false;
        for(var i = 0;i<dirnames.length;i++){
            var dir = dirnames[i];
            if(dir.indexOf("_") == 0){
                // stop processing
                hasUnderscore = true;
                i = dirnames.length;
            }
        }

        if(hasUnderscore){
            // ignore
            return cb();
        }
        else{
            //this.push(file);
            return cb(null, file);
        }
    });
}