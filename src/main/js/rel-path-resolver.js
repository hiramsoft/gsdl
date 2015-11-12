var through = require('through2');
var path = require('path');

module.exports = function(options){
    return through.obj(function(file, enc, cb){
        try {
            file.data = file.data || {};
            file.data.site = file.data.site || {};

            /**
             * Given an abspath as input, this resolve the relative
             * path for an arbitrary resource
             * @param p
             * @returns {*|string}
             */
            file.data.site.relpath = function (p) {
                return file.data.site._unsafeResolver(p) || "";
            };

            /**
             * Same thing as relpath except assumes you mean a document
             * @param p
             * @returns {*}
             */
            file.data.site.docpath = function (p) {
                var query = p;
                if (p && p.lastIndexOf("/") == p.length - 1) {
                    query = p + "index.html";
                }
                var extname = path.extname(query);
                if (!extname || extname == "") {
                    query = query + "/index.html";
                }
                var relDir = file.data.site._unsafeResolver(query);
                if (!relDir || relDir.length == 0) {
                    // don't want to return an absolute path by mistake
                    return "index.html";
                } else {
                    return relDir;
                }
                return relDir;

            };

            /**
             * It's silly how much work this is to work around path.relative
             * not quite working for the web.
             * @param p the abs path in the dist folder
             * @returns {*}
             */
            file.data.site._unsafeResolver = function (p) {
                if(!p){
                    return "";
                }

                var targetFile = path.join(file.base, p);
                var targetName = path.basename(targetFile);
                if (p == "/") {
                    targetName = "";
                }

                var targetDir = path.dirname(targetFile);
                var sourceDir = path.dirname(file.path);

                var relDir = path.relative(sourceDir, targetDir);
                if(!relDir){
                    relDir = "";
                }

                var relPath = path.join(relDir, targetName);
                return relPath;

            };

            cb(null, file);
        }
        catch(e){
            e.message = "Error adding relative path to " + file.path + ": " + e.message;
            cb(e);
        }
    });
}