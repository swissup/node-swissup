# Release builder package

### Usage Examples

1. Use ready to-use [release builder repository](https://github.com/swissup/gulp-release-builder)
2. Or create your own gulpfile:

    Create `package.json` file:
    
    ```json
    {
        "private": true,
        "dependencies": {
            "gulp": "*",
            "gulp-zip": "*",
            "node-swissup": "git://github.com/swissup/node-swissup.git#master"
        }
    }
    ```

    Create `gulpfile.js` file:

    ```js
    var gulp = require('gulp'),
        zip  = require('gulp-zip'),
        swissup = require('node-swissup');

    var module = 'swissup/highlight';

    gulp.task('composer', function(cb) {
        swissup
            .setPackage(module)
            .initComposerJson()
            .runComposer(cb);
    });

    gulp.task('default', ['composer'], function(cb) {
        swissup.setPackage(module);
        return gulp.src(swissup.getPath('release/**/*'))
            .pipe(zip(swissup.getArchiveName()))
            .pipe(gulp.dest(swissup.getPath('bin')));
    });
    ```

    Run the script:

    ```
    npm install
    gulp
    ```
