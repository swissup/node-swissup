var exec = require('child_process').exec,
    fs = require('fs'),
    gutil = require('gulp-util');

module.exports = function() {
    var packageVendor,
        packageName,
        packageVersion,
        nochecker = false,
        nocore = false;
    return {
        setNocore: function(flag) {
            nocore = flag;
            return this;
        },
        setNochecker: function(flag) {
            nochecker = flag;
            return this;
        },
        setPackage: function(name) {
            var info = this.getPackageInfo(name);
            packageName = info.name;
            packageVersion = info.version;
            packageVendor = info.vendor;

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
            info.vendor = name.split('/')[0];

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
            return packageName.split('/')[1] +
                '-' +
                version +
                (nochecker ? '' : '-swissup') +
                (nocore ? '-nocore' : '') +
                '.zip';
        },
        getVendorName: function() {
            return packageVendor;
        },
        getDestinationFolder: function() {
            return packageName + (nochecker ? '-nochecker' : '-checker');
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
        generateComposerRequireSection: function(additionalPackages) {
            var require = {};

            switch (packageVendor) {
                case 'swissup':
                    require['swissup/composer-swissup'] = '^1.1.0';
                    if (!nochecker) {
                        require['swissup/module-subscription-checker'] = '^1.2.0';
                    }
                    break;
                case 'tm':
                    require['magento-hackathon/magento-composer-installer'] = '^4.0.0';
                    if (!nochecker) {
                        require['tm/subscription-checker'] = '*';
                    }
                    break;
            }

            additionalPackages.split(',').forEach(function(name) {
                if (!name.length) {
                    return;
                }
                var info = this.getPackageInfo(name);
                require[info.name] = info.version;
            }, this);

            require[packageName] = packageVersion;

            return require;
        },
        initComposerJson: function(additionalPackages) {
            var filename = this.getPath('composer.json');
            try {
                fs.accessSync(filename, fs.W_OK);
                var data = fs.readFileSync(filename, {
                    encoding: 'utf8'
                });

                data = JSON.parse(data);
                data.require = this.generateComposerRequireSection(additionalPackages);
                fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf8', function(err) {
                    console.log(err);
                });

                return this;
            } catch (e) {}

            var content = {
                "minimum-stability": "stable",
                require: this.generateComposerRequireSection(additionalPackages),
                repositories: [{
                    type: "composer",
                    url: "https://docs.swissuplabs.com/packages/"
                }, {
                    type: "composer",
                    url: "https://tmhub.github.io/packages/"
                }, {
                    type: "vcs",
                    url: "git@github.com:swissup/composer-swissup.git"
                }]
            };

            // magento 1.x modules
            if (packageVendor === 'tm') {
                content.extra = {
                    "magento-root-dir": "src",
                    "magento-deploystrategy": "copy",
                    "magento-force": true
                };
                content.config = {
                    "allow-plugins": {
                        "magento-hackathon/magento-composer-installer": true
                    }
                };
            }

            fs.writeFileSync(filename, JSON.stringify(content, null, 4), 'utf8', function(err) {
                console.log(err);
            });

            return this;
        },
        runComposer: function(cb) {
            var self = this;
            var cmd;
            var options = [
                '--no-autoloader',
                '--no-interaction',
                '--ignore-platform-reqs'
            ];

            if (packageVendor === 'tm') {
                options.push('--no-plugins');
            }

            try {
                fs.accessSync(this.getPath('composer.lock'), fs.F_OK);
                cmd = 'composer update';
            } catch (e) {
                cmd = 'composer install';
            }

            gutil.log(cmd, 'is running');

            exec(
                this.getCmd(cmd + ' ' + options.join(' ')),
                function (err, stdout, stderr) {
                    if (err !== null) {
                        cb(err);
                        console.error(err);
                        return;
                    }

                    if (packageVendor !== 'tm') {
                        return cb();
                    }

                    var cmd = 'composer run-script post-install-cmd -- --redeploy';
                    if (nocore) {
                        cmd = 'rm -rf vendor/tm/core && ' + cmd;
                    }
                    exec(
                        self.getCmd(cmd),
                        function (err, stdout, stderr) {
                            cb(err);
                            console.error(err);
                        }
                    );
                }
            );
        }
    };
};
