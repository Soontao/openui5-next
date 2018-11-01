var path = require('path');
var babel = require('gulp-babel');
var gulp = require("gulp");
var fs = require("fs")
var { warn } = require("console")
var { filter, includes } = require("lodash")

var srcRoot = path.join(__dirname, "./src")
var ignoreModules = ["testsuite", "testsuite-utils", "sap.ui.demokit", "sap.ui.codeeditor"]
var modules = filter(fs.readdirSync(srcRoot), d => !includes(ignoreModules, d))

gulp.task('build', function () {
  return gulp
    .src(modules.map(m => `src/${m}/src/**/*.js`))
    .pipe(babel())
    .on('error', ({ fileName }) => warn(`WARN ${fileName} convert failed`))
    .pipe(gulp.dest("./dist/"))
});

