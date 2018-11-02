var through2 = require("through2");
var { warn } = require("console");
var { transform } = require("lebab")

var lebabFeatures = ["class"]


module.exports = gulpLabab = () => {

  return through2.obj(function (file, encoding, cb) {

    if (file.isBuffer()) {
      file.contents = Buffer.from(transform(file.contents.toString(), lebabFeatures).code)
    }

    cb(null, file);

  });

};