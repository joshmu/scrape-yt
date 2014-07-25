/*=======================================================================
=            grab all Youtube videos from a playlist/channel            =
=======================================================================*/
'use strict';

var http = require('http');
var querystring = require('querystring');
var xmlParser = require('xml2js').parseString;
var prompt = require('prompt');
var q = require('q');

var youtubeApi = 'http://gdata.youtube.com/feeds/api/';
var playlistSearch = 'playlists/snippets?';
var channelSearch = 'channels?';
var query = {
    v: 2,
    'orderBy': 'relevance'
};

module.exports = function (search, type) {
    //creating a promise which we will give back
    var defer = q.defer();

    //add search to query object
    query.q = search;

    //convert options object to a query string
    var qs = querystring.stringify(query);

    //search url based on type specified
    var search = type === 'playlist' ? playlistSearch : channelSearch;
    var url = youtubeApi + search;
    var searchUrl = url + qs;
    var content = '';

    http.get(searchUrl, function(res) {
        res.on('data', function(chunk) {
            if (typeof chunk === 'string') {
                content += chunk;
            } else if (typeof chunk === 'object' && chunk instanceof Buffer) {
                content += chunk.toString('utf8');
            }
        });

        res.on('error', function(err) {
            if (err) throw err;
        });

        res.on('end', function() {
            parseResponse(content)
                .then(defer.resolve, defer.reject)
        });
    });
    return defer.promise;
};

/**
 * convert xml content to a javascript object
 * @param  {String} content > xml content
 * @return {Promise}       > resolve = list of playlists
 */
function parseResponse(content) {
    var defer = q.defer();
    xmlParser(content, function(err, result){
        if(err) {
            defer.reject(err);
        }
        //playlists = result.feed.entry[]
        defer.resolve(result.feed.entry);
    });
    return defer.promise;
}
