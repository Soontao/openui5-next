var path = require('path');
var babel = require('gulp-babel');
var gulp = require("gulp");
var fs = require("fs")
var { filter } = require("lodash")

var srcRoot = path.join(__dirname, "./src")

var modules = filter(fs.readdirSync(srcRoot), d => !d.startsWith("testsuite"))

gulp.task('build', function () {
  gulp.series(
    modules.map(m =>
      gulp
        .src(`src/${m}/src/**/*.js`)
        .pipe(babel())
        .pipe(gulp.dest("./dist/"))
    )
  )


});
