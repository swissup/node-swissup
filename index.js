var exec = require('child_process').exec,
    fs = require('fs'),
    gutil = require('gulp-util');

module.exports = (function() {
    var packageName, packageVersion;

    return {
        setPackage: function(name) {
            var info = this.getPackageInfo(name);
            packageName = info.name;
            packageVersion = info.version;

            var parent = '';
            this.getDestinationFolder().split('/').forEach(function(folder) {
                try {
                    fs.accessSync(parent + folder, fs.W_OK);
                } catch (e) {
                    fs.mkdirSync(parent + folder);
                }
                parent = folder + '/';
            });
            return this;
        },
        getPackageInfo: function(name) {
            var info = {};
            if (name.indexOf('/') === -1) {
                name = 'swissup/' + name;
            }
            if (name.indexOf(':') === -1) {
                name += ':*';
            }

            info.name = name.split(':')[0];
            info.version = name.split(':')[1];

            return info;
        },
        getArchiveName: function() {
            var version = packageVersion.replace(/[^a-zA-Z0-9.\-]/, '');
            if (!version.length) {
                var date = new Date();
                version = [
                    date.getFullYear(),
                    ("0" + (date.getMonth() + 1)).slice(-2),
                    ("0" + date.getDate()).slice(-2)
                ].join('-');
            }
            return packageName.split('/')[1] + '-' + version + '.zip';
        },
        getDestinationFolder: function() {
            return packageName;
        },
        getPath: function(file) {
            return this.getDestinationFolder() + '/' + file;
        },
        getCmd: function(cmd) {
            return 'cd ' + this.getDestinationFolder() + ' && ' + cmd;
        },
        reset: function(cb) {
            try {
                fs.accessSync(this.getDestinationFolder(), fs.W_OK);
            } catch (e) {
                return cb();
            }

            var files = [
                'composer.lock',
                'composer.json',
                'vendor/composer/installed.json'
            ];
            files.forEach(function(file) {
                var path = this.getPath(file);
                try {
                    fs.accessSync(path, fs.F_OK);
                    fs.unlinkSync(path);
                } catch (e) {}
            }, this);
            try {
                fs.accessSync(this.getPath('release'), fs.F_OK);
                exec(this.getCmd('rm -rf release'));
            } catch (e) {}

            cb();
        },
        initComposerJson: function(additionalPackages, excludeChecker) {
            var filename = this.getPath('composer.json');
            try {
                fs.accessSync(filename, fs.W_OK);
                gutil.log(
                    gutil.colors.magenta("Warning!"),
                    gutil.colors.cyan(
                        "Existing composer.json with previously generated data will be used."
                    )
                );
                gutil.log(gutil.colors.cyan(
                    "If you would like to change composer.json, use `--reset` option."
                ));
                return this;
            } catch (e) {}

            var content = {
                "minimum-stability": "dev",
                require: {
                    "swissup/composer-swissup": "*"
                },
                repositories: [{
                    type: "composer",
                    url: "http://swissup.github.io/packages/"
                }, {
                    type: "composer",
                    url: "http://tmhub.github.io/packages/"
                }, {
                    type: "vcs",
                    url: "git@github.com:swissup/composer-swissup.git"
                }]
            };
            if (!excludeChecker) {
                // content.require['swissup/subscription-checker'] = '*';
            }
            additionalPackages.split(',').forEach(function(name) {
                if (!name.length) {
                    return;
                }
                var info = this.getPackageInfo(name);
                content.require[info.name] = info.version;
            }, this);
            content.require[packageName] = packageVersion;

            content = JSON.stringify(content, null, 4);
            fs.writeFileSync(filename, content, 'utf8', function(err) {
                console.log(err);
            });

            return this;
        },
        runComposer: function(cb) {
            var cmd;

            try {
                fs.accessSync(this.getPath('composer.lock'), fs.F_OK);
                cmd = 'composer update';
            } catch (e) {
                cmd = 'composer install';
            }

            gutil.log(cmd, 'is running');
            exec(this.getCmd(cmd + ' --no-autoloader'), function (err, stdout, stderr) {
                console.log(stdout);
                console.log(stderr);
                cb(err);
            });
        }
    };
})();
