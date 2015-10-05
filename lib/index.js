'use strict';
var AbstractStrategy = require('rest-me').Strategy,
    util = require('util'),
    Q = require('q'),
    rest = require('rest'),
    URL = require('url'),
    mime = require('rest/interceptor/mime'),
    client = rest.wrap(mime),
    _ = require('lodash');

function DeezerStrategy(accessToken) {
    this.accessToken = accessToken;
    this.apiEndpoint = 'api.deezer.com';
    this.protocol = 'https';
}

util.inherits(DeezerStrategy, AbstractStrategy);

DeezerStrategy.prototype._get = function(path) {
    var done = Q.defer();
    var parsedUrl = URL.parse(path, true);
    parsedUrl.protocol = parsedUrl.protocol || this.protocol;
    parsedUrl.host = parsedUrl.host || this.apiEndpoint;
    parsedUrl.search = null;
    parsedUrl.query.access_token = this.accessToken;
    client({
        method: 'get',
        path: parsedUrl.format()
    }).then(function(response) {
        if (response.entity.error != null) {
            done.reject(response.entity.error);
        } else {
            done.resolve(response);
        }
    }, function(err) {
        done.reject(err);
    })

    return done.promise;
}

DeezerStrategy.prototype.get = function(path) {
    return this._get(path);
}

DeezerStrategy.prototype.getPaginatedList = function(path) {
    var done = Q.defer(),
        promises = [];
    var that = this;
    this._get(path).then(function(response) {
        if (!response.entity.total) {
            throw new Error('Path response does not represent a paginated list');
        }

        if (!response.entity.next) {
            done.resolve(response.entity);
        } else {
            var total = parseInt(response.entity.total);
            var firstResults = response.entity.data;
            var next = response.entity.next;
            var parsedUrl = URL.parse(next, true);
            var index = parseInt(parsedUrl.query.index);
            while (index < total) {
                parsedUrl.search = null;
                parsedUrl.query.index = index;
                promises.push(that._get(parsedUrl.format()));
                index += 50;
            }
            Q.all(promises).then(function(data) {
                var nextResults = data.map(function(item) {
                    return item.entity.data;
                });
                var results = _.flatten([firstResults, nextResults], true);
                done.resolve({
                    data: results
                });
            }, function(err) {
                done.reject(err);
            });
        }
    })

    return done.promise;
}

module.exports = DeezerStrategy;