// Would have loved to use https://github.com/carlosl/gulp-nunjucks-render
// but gulp seems to get hung by calling gnunjucks.gnunjucks.configure()

var through = require('through2');
var nunjucks = require('nunjucks');

module.exports = function(templatePath, opts){
    var env = new nunjucks.Environment(
        new nunjucks.FileSystemLoader(
            templatePath,
            {
                watch: false, // nunjucks will block gulp unless this is here
                noCache: true // nunjucks will not play well with gulp's watch without this
            }
        ),
        opts
    );

    return through.obj(function (file, enc, cb) {
        try {

            if (file.isNull()) {
                cb(null, file);
                return false;
            }

            if (file.isStream()) {
                cb('Streaming is not supported');
            }
            else {
                env.renderString(file.contents.toString(), file.data || {}, function (err, result) {
                    if (err) {
                        console.error("Nunjucks Error");
                        console.error("  ", err.message);
                        console.error("   file: ", file.path);
                        console.error("");
                        // swallow the error so watch doesn't croak
                        cb(err);
                    }
                    else {
                        file.contents = new Buffer(String(result));
                        cb(null, file);
                    }
                });
            }
        }
        catch(e){
            console.error("Nunjucks Error");
            console.error("  ", e.message);
            console.error("   file: ", file.path);
            console.error("");
            cb(e);
        }
    });
}