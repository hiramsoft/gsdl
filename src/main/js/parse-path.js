var path = require('path');

module.exports = function(p) {
    var extname = path.extname(p);
    return {
        dirname: path.dirname(p),
        basename: path.basename(p, extname),
        extname: extname
    };
}