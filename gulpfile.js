'use strict';

const $ = require('gulp-load-plugins')();
const del = require('del');
const gulp = require('gulp');
const manifest = require('./package.json');
const path = require('path');

const coverageDir = path.join(__dirname, 'coverage');
const distDir = path.join(__dirname, 'dist');
const docsDir = path.join(__dirname, 'documentation');
const stagingDir = path.join(__dirname, 'staging');

/*
 * Clean tasks
 */
gulp.task('clean', ['clean-coverage', 'clean-dist', 'clean-docs', 'clean-staging', 'clean-zip']);

gulp.task('clean-coverage', function (done) {
	del([coverageDir]).then(function () { done(); });
});

gulp.task('clean-dist', function (done) {
	del([distDir]).then(function () { done(); });
});

gulp.task('clean-docs', function (done) {
	del([docsDir]).then(function () { done(); });
});

gulp.task('clean-staging', function (done) {
	del([stagingDir]).then(function () { done(); });
});

gulp.task('clean-zip', function (done) {
	del(['*.zip']).then(function () { done(); });
});

/*
 * build tasks
 */
gulp.task('build', ['clean-dist', 'lint-src'], function () {
	return gulp
		.src('src/index.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.sourcemaps.init())
		.pipe($.rollup({
			sourceMap: true
		}))
		.pipe($.babel())
		.pipe($.rename(manifest.name + '.js'))
		.pipe($.sourcemaps.write('.'))
		.pipe(gulp.dest(distDir));
});

gulp.task('prep', ['build', 'docs'], function () {
	// TODO Include documentation!
	return gulp.src(['dist/' + manifest.name + '.js', 'package.json', 'manifest', 'LICENSE'])
		.pipe(gulp.dest(path.join(__dirname, 'staging', 'modules', 'commonjs', manifest.name, manifest.version)));
});

gulp.task('dist', ['prep'], function () {
	return gulp.src('staging/**/*')
		.pipe($.zip(manifest.name + '-commonjs-' + manifest.version + '.zip'))
		.pipe(gulp.dest(__dirname));
});

gulp.task('docs', ['lint-src', 'clean-docs'], function () {
	return gulp.src('src')
		.pipe($.plumber())
		.pipe($.debug({ title: 'docs' }))
		.pipe($.esdoc({
			// debug: true,
			destination: docsDir,
			plugins: [
				{ name: 'esdoc-es7-plugin' }
			],
			title: manifest.name
		}));
});

/*
 * lint tasks
 */
function lint(pattern) {
	return gulp.src(pattern)
		.pipe($.plumber())
		.pipe($.eslint())
		.pipe($.eslint.format())
		.pipe($.eslint.failAfterError());
}

gulp.task('lint-src', function () {
	return lint('src/**/*.js');
});

gulp.task('lint-test', function () {
	return lint('test/**/test-*.js');
});

/*
 * test tasks
 */
gulp.task('test', ['lint-src', 'lint-test'], function () {
	var suite, grep;
	var p = process.argv.indexOf('--suite');
	if (p !== -1 && p + 1 < process.argv.length) {
		suite = process.argv[p + 1];
	}
	p = process.argv.indexOf('--grep');
	if (p !== -1 && p + 1 < process.argv.length) {
		grep = process.argv[p + 1];
	}

	return gulp.src(['src/**/*.js', 'test/**/*.js'])
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.babel())
		.pipe($.injectModules())
		.pipe($.filter(suite ? ['test/setup.js'].concat(suite.split(',').map(s => 'test/**/test-' + s + '.js')) : 'test/**/*.js'))
		.pipe($.debug({ title: 'test' }))
		.pipe($.mocha({ grep: grep }));
});

gulp.task('coverage', ['lint-src', 'lint-test', 'clean-coverage'], function (cb) {
	gulp.src('src/**/*.js')
		.pipe($.plumber())
		.pipe($.debug({ title: 'build' }))
		.pipe($.babelIstanbul())
		.pipe($.injectModules())
		.on('finish', function () {
			gulp.src('test/**/*.js')
				.pipe($.plumber())
				.pipe($.debug({ title: 'test' }))
				.pipe($.babel())
				.pipe($.injectModules())
				.pipe($.mocha())
				.pipe($.babelIstanbul.writeReports())
				.on('end', cb);
		});
});

gulp.task('default', ['build']);
