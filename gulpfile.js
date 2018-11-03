var path = require('path');
var babel = require('gulp-babel');
var gulp = require("gulp");
var fs = require("fs")
var less = require('gulp-less');
var del = require('del');
var { filter, includes, concat } = require("lodash")

var srcRoot = path.join(__dirname, "./src")
var themeModules = ["themelib_sap_belize", "themelib_sap_bluecrystal"]
var testModules = ["testsuite", "testsuite-utils"]
var ignoreModules = concat(themeModules, testModules, ["sap.ui.demokit", "sap.ui.codeeditor"])
var modules = fs.readdirSync(srcRoot)
var jsModules = filter(modules, d => !includes(ignoreModules, d))

gulp.task("copy:thirdpartylib", () => gulp.src("./src/sap.ui.core/src/sap/ui/thirdparty/**/*").pipe(gulp.dest("./dist/sap/ui/thirdparty/")))

gulp.task("copy:properties", () => gulp.src(modules.map(m => `./src/${m}/src/**/*.properties`)).pipe(gulp.dest("./dist/")))

gulp.task("forward:es6module", () => gulp.src(
  concat(jsModules.map(m => `src/${m}/src/**/*.js`), "!src/sap.ui.core/src/sap/ui/thirdparty/**/*")).pipe(babel()).pipe(gulp.dest("./dist/"))
)

gulp.task("less", gulp.series(
  function copyLess() { return gulp.src(concat(themeModules, jsModules).map(m => `src/${m}/src/**/*.{less,css,json,woff,ttf,woff2,TTF}`)).pipe(gulp.dest("./dist/")) },
  function compileLess() { return gulp.src(concat(themeModules, jsModules).map(m => `./dist/${m.replace(/\./g, "/")}/**/library.source.less`)).pipe(less()).pipe(gulp.dest("./dist/")) }
))

gulp.task("clean", () => { return del("./dist") })

gulp.task('build', gulp.series("clean", gulp.parallel("copy:thirdpartylib", "forward:es6module", "less")));