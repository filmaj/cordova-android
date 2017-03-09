#!/usr/bin/env node

/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
*/

var Q       = require('q');
var os      = require('os');
// TODO: replace this w/ cordova-common.spawn once ready
var spawn   = require('child-process-promise').spawn;

// TODO: this module is the likely place where it would make sense to search
// for the android sdk, if we end up supporting that.

var get_highest_sdk = function(results){
    var reg = /\d+/;
    var apiLevels = [];
    for(var i=0;i<results.length;i++){
        apiLevels[i] = parseInt(results[i].match(reg)[0]);
    }
    apiLevels.sort(function(a,b){return b-a;});
    console.log(apiLevels[0]);
};

var get_sdks = function() {
    var d = Q.defer();
    // TODO: replace this promise-y flow w/ cordova-common.spawn once ready
    child_process.exec('android list targets', function(err, stdout, stderr) {
        if (err) d.reject(err, stdout, stderr);
        else d.resolve(stdout);
    });

    return d.promise.then(function(output) {
        var reg = /android-\d+/gi;
        var results = output.match(reg);
        if(results.length===0){
            return Q.reject(new Error('No android sdks installed.'));
        }else{
            get_highest_sdk(results);
        }

        return Q();
    }, function(err, stdout, stderr) {
        var avail_regex = /android command is no longer available/gi;
        if (stdout.match(avail_regex) || stderr.match(avail_regex)) {
            // TODO: do the sdkmanager thing
        } else if (stderr.match(/command\snot\sfound/) || stderr.match(/'android' is not recognized/)) {
            return Q.reject(new Error('The command \"android\" failed. Make sure you have the latest Android SDK installed, and the \"android\" command (inside the tools/ folder) is added to your path.'));
        } else {
            return Q.reject(new Error('An error occurred while listing Android targets'));
        }
    });
};

module.exports.get_available_sdk_versions = function() {
    return Q.all([get_sdks()]);
};

module.exports.version_string_to_api_level = {
    "4.0": 14,
    "4.0.3": 15,
    "4.1": 16,
    "4.2": 17,
    "4.3": 18,
    "4.4": 19,
    "4.4W": 20,
    "5.0": 21,
    "5.1": 22,
    "6.0": 23,
    "7.0": 24,
    "7.1.1": 25
};

module.exports.list_targets = function() {
    // TODO: replace w/ cc.superspawn once ready
    // get rid of capture option.
    // change resolve handler to not rely on stdout sub-option
    return spawn('android', ['list', 'targets'], {cwd: os.tmpdir(), capture: [ 'stdout', 'stderr' ]})
    .then(function(result) {
        var target_out = result.stdout.split('\n');
        var targets = [];
        for (var i = target_out.length; i >= 0; i--) {
            if(target_out[i].match(/id:/)) {
                targets.push(targets[i].split(' ')[1]);
            }
        }
        return targets;
    }).catch(function(err) {
        // there's a chance `android` no longer works.
        // lets see if `sdkmanager` is available and we can figure it out
        var avail_regex = /android command is no longer available/;
        if (err.code && (err.stdout.match(avail_regex) || err.stderr.match(avail_regex))) {
            return spawn('sdkmanager', ['--list'], {capture: ['stdout', 'stderr']})
            .then(function(result) {
                var parsing_installed_packages = false;
                var lines = result.stdout.split('\n');
                var targets = [];
                for (var i = 0, l = lines.length; i < l; i++) {
                    var line = lines[i];
                    if (line.match(/Installed packages/)) {
                        parsing_installed_packages = true;
                    } else if (line.match(/Available Packages/) || line.match(/Available Updates/)) {
                        // we are done working through installed packages, exit
                        break;
                    }
                    if (parsing_installed_packages && line.match(/platforms;android-\d+/)) {
                        targets.push(line.match(/android-\d+/)[0].split('-')[1]);
                    }
                }
                return targets;
            });
        } else throw err;
    });
};
