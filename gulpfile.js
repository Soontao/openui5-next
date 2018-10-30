var path = require('path');
var babel = require('gulp-babel');
var gulp = require("gulp")

var srcRoot = path.join(__dirname, "./src")

gulp.task('build', function () {
  gulp.src(['src/**/*.js', '!src/**/*.qunit.js']).pipe(babel()).pipe(gulp.dest('dist'));
});
