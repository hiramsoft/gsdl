/**
 * Synopsis: Adds gsdl-* tasks that are stateless ways to compile
 * projects that follow the Maven Standard Directory Layout using Gulp
 */

// flow control
var _                   = require('lodash');
var StreamMerger        = require('stream-merger');
var Promise             = require('bluebird');
var del                 = require('del');
var path                = require('path');

// file-based filters
var stripMaps           = require('./src/main/js/strip-maps.js');
var ignoreUnderscoreDirs= require('./src/main/js/ignore-underscore-dirs.js');

// javascript
var jspm                = require('stream-jspm');
var uglify              = require('gulp-uglify');

// styling
var minifyCSS           = require('gulp-minify-css');
var less                = require('gulp-less');
var sass                = require('gulp-sass');
var concatCss           = require('gulp-concat');
var sourcemaps          = require('gulp-sourcemaps');
var plumber             = require('gulp-plumber');
var postcss             = require('gulp-postcss');
var autoprefixer        = require('autoprefixer');

// html
var buildInfo           = require('./src/main/js/add-build-info.js');
var relpathResolver     = require('./src/main/js/rel-path-resolver.js');
var gnunjucks           = require('./src/main/js/nunjucks-with-custom-env.js');

// development
var gls                 = require('gulp-live-server');


var reportChange = function (event){
    console.log('File ' + event.path + ' was ' + event.type + ', running tasks...');
};

module.exports._reportChange = reportChange;

var errorHandler = function (error) {
    console.log(error.toString());
    this.emit('end');
};

module.exports._errorHandler = errorHandler;

var isProd = false;

////////////////////////////////////////
//////// Build tasks (i.e. take input files and transform)
////////////////////////////////////////

module.exports._htmlTasks = function(stream, opts){

    var buildOptions = module.exports._acceptOptions(opts);

    // Other libraries like gulpyll may want to provide more context before
    // calling nunjucks
    if(module.exports._hooks._htmlHook){
        stream = module.exports._hooks._htmlHook(stream);
    }

    return stream
        .pipe(buildInfo())
        .pipe(relpathResolver())
        .pipe(gnunjucks(buildOptions.nunjucksTemplatePath, buildOptions.nunjucks))
        ;
};

module.exports._hooks = {};

module.exports._hooks._htmlHook = function(stream){
    return stream;
};

module.exports.build = function(gulp, opts){

    var buildOptions = module.exports._acceptOptions(opts);

    // this exists so gulpyll and others can block building html
    // until after they load all data
    gulp.task('gsdl-build-data', function(cb){
        cb();
    });

    gulp.task('gsdl-build-html', ['gsdl-build-data'], function(){
        var htmlSettings = buildOptions.html;

        var htmlStream = gulp.src(htmlSettings.srcPath)
            .pipe(ignoreUnderscoreDirs());

        // other libraries may want to compile HTML-like things in a similar way
        htmlStream = module.exports._htmlTasks(htmlStream,opts);

        htmlStream.on('error', function(e) {
            console.error("HTML Error:", e.message);
            this.emit('end');
        });

        htmlStream
            .pipe(gulp.dest(htmlSettings.destPath));
    });

    function lessTasks (stream, options){
        return stream
            .pipe(ignoreUnderscoreDirs())
            .pipe(less());
        /*{
         paths: [path.join(__dirname, 'less', 'includes')]
         }
         */
    }

    function sassTasks (stream, options){
        return stream
            .pipe(ignoreUnderscoreDirs())
            .pipe(sass());
    }

    function cssTasks (stream, options){
        return stream.pipe(ignoreUnderscoreDirs());
    }

    gulp.task('gsdl-build-less', function(){
        var lessSettings = buildOptions.less;

        var lessStream =  lessTasks(gulp.src(lessSettings.srcPath));

        if(isProd){
            lessStream = lessStream
                .pipe(stripMaps())
                .pipe(minifyCSS());
        }

        lessStream.on('error', function(e) {
            console.error("LESS Error:", e.message);
            this.emit('end');
        });

        return lessStream
            .pipe(gulp.dest(lessSettings.destPath));
    });

    gulp.task('gsdl-build-scss', function(){
        var sassSettings = buildOptions.scss || buildOptions.sass;

        var sassStream = sassTasks(gulp.src(sassSettings.srcPath));

        if(isProd){
            sassStream = sassStream
                .pipe(stripMaps())
                .pipe(minifyCSS());
        }

        sassStream.on('error', function(e) {
            console.error("SCSS Error:", e.message);
            this.emit('end');
        });

        return sassStream
            .pipe(gulp.dest(sassSettings.destPath));
    });

    gulp.task('gsdl-build-css', function(){
        var cssSettings = buildOptions.css;

        var cssStream = cssTasks(gulp.src(cssSettings.srcPath));
        if(isProd){
            cssStream = cssStream
                .pipe(stripMaps())
                .pipe(minifyCSS());
        }

        cssStream.on('error', function(e) {
            console.error("CSS Error:", e.message);
            this.emit('end');
        });

        return cssStream
            .pipe(gulp.dest(cssSettings.destPath));
    });

    gulp.task('gsdl-build-style', function(){

        var styleSettings = buildOptions.style;

        return new Promise( function(resolve, reject){
            var bundlesComplete = 0;
            if(!styleSettings || !styleSettings.bundles || styleSettings.bundles.length == 0){
                return resolve(0);
            }
            var totalBundles = styleSettings.bundles.length;

            function bundleComplete() {
                bundlesComplete++;
                if (bundlesComplete >= totalBundles) {
                    resolve(bundlesComplete);
                }
            };

            for (var bundleI = 0; bundleI < styleSettings.bundles.length; bundleI++) {

                var bundle = styleSettings.bundles[bundleI];

                var lessStream = lessTasks(gulp.src(bundle.lessIn));

                var sassStream = sassTasks(gulp.src(bundle.sassIn));

                var cssStream = cssTasks(gulp.src(bundle.cssIn));

                var combinedStream =
                    StreamMerger([lessStream, sassStream, cssStream])
                    .pipe(concatCss(bundle.out))
                    .pipe(sourcemaps.init())
                    .pipe(postcss([ autoprefixer({ browsers: ['last 2 version'] }) ]))
                    ;

                if(isProd){
                    combinedStream = combinedStream
                        .pipe(stripMaps())
                        .pipe(minifyCSS());
                }
                else {
                    combinedStream = combinedStream
                        .pipe(sourcemaps.write('.'));
                }

                combinedStream.on('error', function(e) {
                    console.error("Bundle Error:", e.message);
                    reject(e);
                });

                combinedStream
                    .pipe(gulp.dest(styleSettings.destPath))
                    .on('end', function(){
                        bundleComplete()
                    });
            }
        });
    });

    gulp.task('gsdl-build-es6', function(cb){
        var es6Settings = buildOptions.es6;
        var es6Stream = gulp.src(es6Settings.srcPath)
            .pipe(jspm.bundleSfx());

        if(isProd){
            es6Stream = es6Stream
                .pipe(stripMaps())
                .pipe(uglify());
        }

        es6Stream.on('error', function(e) {
            console.error("JSPM Error:", e.message);
            this.emit('end');
        });

        return es6Stream
            .pipe(gulp.dest(es6Settings.destPath))
            ;
    });

    gulp.task('gsdl-build-js', function () {
        var jsSettings = buildOptions.js;
        var jsStream = gulp.src(jsSettings.srcPath)
            .pipe(ignoreUnderscoreDirs());

        if(isProd){
            jsStream = jsStream
                .pipe(stripMaps())
                .pipe(uglify());
        }

        jsStream.on('error', function(e) {
            console.error("JS.ES5 Error:", e.message);
            this.emit('end');
        });

        return jsStream
            .pipe(gulp.dest(jsSettings.destPath));
    });

    gulp.task('gsdl-build', ['gsdl-build-html', 'gsdl-build-es6', 'gsdl-build-js', 'gsdl-build-style', 'gsdl-build-less', 'gsdl-build-scss', 'gsdl-build-css']);
};

////////////////////////////////////////
//////// Copy tasks (i.e. take input files verbatim)
////////////////////////////////////////
module.exports.copy = function(gulp, opts) {

    var copyOptions = module.exports._acceptOptions(opts);

    gulp.task('gsdl-copy-fonts', function () {
        var fontSettings = copyOptions.fonts;
        return gulp.src(fontSettings.srcPath)
            /*
            .pipe(rename(function (path) {
                path.dirname = '.';
            }))
            */
            .pipe(gulp.dest(fontSettings.destPath));
    });

    gulp.task('gsdl-copy-static', function () {
        var staticSettings = copyOptions.statics;
        return gulp.src(staticSettings.srcPath)
            .pipe(gulp.dest(staticSettings.destPath));
    });

    gulp.task('gsdl-copy-data', function () {
        var dataSettings = copyOptions.data;
        return gulp.src(dataSettings.srcPath)
            .pipe(gulp.dest(dataSettings.destPath));
    });

    gulp.task('gsdl-copy', ['gsdl-copy-fonts', 'gsdl-copy-static', 'gsdl-copy-data']);
};

////////////////////////////////////////
//////// Clean tasks
////////////////////////////////////////

module.exports.clean = function(gulp, opts) {

    var cleanOptions = module.exports._acceptOptions(opts);
    //options = options || {};

    // Removes all files from ./dist/
    gulp.task(cleanOptions.cleanName || 'clean', function (cb) {
        return del([cleanOptions.dist], cb);
    });

};

////////////////////////////////////////
//////// Options aka Settings
////////////////////////////////////////


module.exports._mergeOptions = function(defaultSettings, provided){

    // re-entrant
    if(provided.__isMerged){
        return provided;
    }

    var mergedSettings = _.merge(defaultSettings, provided);

    mergedSettings = module.exports._appendBasePaths(mergedSettings);

    mergedSettings.__isMerged = true;

    return mergedSettings;
};

module.exports._appendBasePaths = function(mergedSettings){
    var SRC_NAME = mergedSettings.base || "src/main/";
    var DIST_NAME = mergedSettings.dist || "dist";

    mergedSettings.dist = DIST_NAME;
    mergedSettings.base = SRC_NAME;

    // the extra logic is to make this function idempotent, even if it is less efficient
    _.forEach(mergedSettings, function (setting, key) {
        if (setting.srcPath) {
            if (_.isArray(setting.srcPath)) {
                setting.srcPath = _.map(setting.srcPath, function (p) {
                    if (p.indexOf(SRC_NAME) < 0) {
                        return path.join(SRC_NAME, p);
                    }
                    else {
                        return p;
                    }
                })
            }
            else {
                if (setting.srcPath.indexOf(SRC_NAME) < 0) {
                    setting.srcPath = path.join(SRC_NAME, setting.srcPath);
                }
                else {
                    // skip
                }
            }
        }

        if(setting.destPath){
            if(setting.destPath.indexOf(DIST_NAME) < 0 ){
                setting.destPath = path.join(DIST_NAME, setting.destPath);
            }
        }
        else {
            setting.destPath = DIST_NAME;
        }
    });

    // need to make gnunjucks and ng templates work together
    if(mergedSettings.html && mergedSettings.html.srcPath) {
        var globLoc = mergedSettings.html.srcPath.indexOf("*");
        if (globLoc <= 0) {
            globLoc = mergedSettings.html.srcPath.length;
        }
        var htmlTemplatePath = mergedSettings.html.srcPath.substring(0, globLoc);

        mergedSettings.nunjucksTemplatePath = mergedSettings.nunjucksTemplatePath || htmlTemplatePath;
    }

    return mergedSettings;
};

module.exports._acceptOptions = function(opts){

    try {

        var options = opts || {};

        var defaultSettings = {
            "server": {
                "port": 8080
            },
            "es6": {
                "srcPath": ["es6/*.js"],
                "destPath": ""
            },
            "less": {
                "srcPath": ["less/*.less"],
                "destPath": ""
            },
            "scss": {
                "srcPath": ["sass/*.sass", "scss/*.scss"],
                "destPath": ""
            },
            "js": {
                "srcPath": ["js/**/*.js"],
                "destPath": ""
            },
            "css": {
                "srcPath": ["css/**/*.css"],
                "destPath": ""
            },
            "style": {
                "bundles": [
                    /*
                    {
                        lessIn: ['less/app.less'], //////// Entry point for LESS
                        sassIn: ['scss/app.scss'], //////// Entry point for SCSS
                        cssIn: ['css/** /*.css'], //////// Uncompiled legacy CSS to include
                        out: "bundle.css" // Filename for compiled css
                    }
                    */
                ],
                "destPath": ""
            },
            "fonts": {
                "srcPath": [],
                "destPath": ""
            },
            "html": {
                "srcPath": "html/**/*.html",
                "destPath": ""

            },
            "nunjucks": {
                "tags": {
                    "blockStart": '{%',
                    "blockEnd": '%}',
                    "variableStart": '{$',
                    "variableEnd": '$}',
                    "commentStart": '{#',
                    "commentEnd": '#}'
                },
                "watch": false
            },
            "statics": {
                "srcPath": "static/**/*",
                "destPath": ""
            },
            "data": {
                "srcPath": "data/**/*.json",
                "destPath": ""
            }
        };

        return module.exports._mergeOptions(defaultSettings, options);
    }
    catch (e){
        console.error("Error accepting settings", e);
        return {};
    }
};

////////////////////////////////////////
//////// Development tasks
////////////////////////////////////////

module.exports.dev = function(gulp, opts) {
    var devOptions = module.exports._acceptOptions(opts);

    var runServer = function() {

        return function () {

            var serverSettings = devOptions.server;

            return new Promise(function (resolve, reject) {

                console.log("Starting server...");
                //2. serve at custom port
                var server = gls.static(devOptions.dist, serverSettings.port || 8080);
                server.start();

                //use gulp.watch to trigger server actions(notify, start or stop)
                return gulp.watch([devOptions.dist + '/**/*'], function () {
                    server.notify.apply(server, arguments);
                });
            })
        }
    };

    gulp.task('serve', ['default', 'watch'], runServer() );

    // serve-prod is to test out minified builds
    // use serve for active development
    gulp.task('serve-prod', ['dist', 'watch'], runServer() );

    gulp.task('gsdl-watch', ['default'], function() {
        var allOpts = module.exports._acceptOptions(opts);
        gulp.watch(allOpts.style.srcPath, ['gsdl-build-style']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.es6.srcPath, ['gsdl-build-es6']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.js.srcPath, ['gsdl-build-js']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.css.srcPath, ['gsdl-build-css']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.less.srcPath, ['gsdl-build-less']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.scss.srcPath, ['gsdl-build-scss']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.html.srcPath, ['gsdl-build-html']).on('change', module.exports._reportChange);

        gulp.watch(allOpts.fonts.srcPath, ['gsdl-copy-fonts']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.statics.srcPath, ['gsdl-copy-static']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.data.srcPath, ['gsdl-copy-data']).on('change', module.exports._reportChange);
    });

    gulp.task('watch', ['gsdl-watch']);

    gulp.task('watch2', ['build'], function(){
        var allOpts = module.exports._acceptOptions(opts);
        gulp.watch(allOpts.style.srcPath, ['gsdl-build-style']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.es6.srcPath, ['gsdl-build-es6']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.js.srcPath, ['gsdl-build-js']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.css.srcPath, ['gsdl-build-css']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.less.srcPath, ['gsdl-build-less']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.scss.srcPath, ['gsdl-build-scss']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.html.srcPath, ['gsdl-build-html']).on('change', module.exports._reportChange);

        gulp.watch(allOpts.fonts.srcPath, ['gsdl-copy-fonts']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.statics.srcPath, ['gsdl-copy-static']).on('change', module.exports._reportChange);
        gulp.watch(allOpts.data.srcPath, ['gsdl-copy-data']).on('change', module.exports._reportChange);
    });


    gulp.task('is-stuck', ['watch2'], runServer());
};

////////////////////////////////////////
//////// Production tasks
////////////////////////////////////////

module.exports.dist = function(gulp, opts){

    gulp.task('gsdl-build-for-prod', function(cb){
        isProd = true;
        cb();
    });

    gulp.task('dist', ['gsdl-build-for-prod', 'default']);
};

////////////////////////////////////////
//////// Porcelain tasks
////////////////////////////////////////
module.exports.trio = function(gulp, opts) {

    module.exports.build(gulp, opts);
    module.exports.copy(gulp, opts);
    module.exports.clean(gulp, opts);

};

/**
 * Convenience wrapper for the advertised simplicity in the readme
 * In practice build scripts are almost always custom jobs.
 * @param gulp (optional) provide your own gulp instance
 * @param opts (optional) provide your own gsdl options
 */
module.exports.porcelain1 = function(gulp, opts) {

    var usedOpts = opts || {};
    var usedGulp = gulp;

    if(!opts){
        if(usedGulp && usedGulp.task){
            // looks like a gulp
        }
        else {
            usedOpts = gulp;
            usedGulp = require('gulp');
        }
    }

    module.exports.trio(usedGulp, usedOpts);
    module.exports.dist(usedGulp, usedOpts);
    module.exports.dev(usedGulp, usedOpts);

    usedGulp.task('default', ['build', 'copy']);

    usedGulp.task('build', ['gsdl-build']);

    usedGulp.task('copy', ['gsdl-copy']);

};