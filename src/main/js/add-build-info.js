var buildCache = {};
var through = require('through2');
var revision = require('git-rev');

/**
 * Synopsis - adds a "build" object to the file.data, which includes git and version info
 * @param options
 */

module.exports = function(version){
    return through.obj(function(file, enc, cb){

        file.data = file.data || {};

        if(buildCache.short){
            file.data.build = buildCache;

            cb(null, file);
        }
        else {
            var buildInfo = {
                short: "Development",
                branch: "master",
            };
            if(version){
                buildInfo.version = version;
            }
            buildInfo.date = new Date().toISOString();

            revision.short(function (str) {
                buildInfo.short = str;
                revision.branch(function (str) {
                    buildInfo.branch = str;

                    file.data.build = buildInfo;
                    buildCache = buildInfo;

                    cb(null, file);
                });
            });
        }
    });
}