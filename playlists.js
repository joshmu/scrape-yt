/**
*
* https://gdata.youtube.com/feeds/api/playlists/snippets?
    q=GoogleDevelopers
    &start-index=11
    &max-results=10
    &v=2
*
**/

/*===================================================================
=            grab all the youtube playlists by relevance            =
===================================================================*/
'use strict';

var http = require('http');
var querystring = require('querystring');
var xmlParser = require('xml2js').parseString;
var prompt = require('prompt');
var q = require('q');

var url = 'http://gdata.youtube.com/feeds/api/playlists/snippets?';
var options = {
    v: 2,
    'orderBy': 'relevance'
};

module.exports = function askYt(query, cb) {
    extender(options, query);

    //convert options object to a query string
    var qs = querystring.stringify(options);
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
                .then(cb)
                .then(null, console.error)
                .done();
        });
    });
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


/**
 * extend an object's properties with another object
 * @param  {Object} obj1 > primary object to be extended
 * @param  {Object} obj2
 */
function extender(obj1, obj2) {
    for(var key in obj2) {
        if(obj2.hasOwnProperty(key)) {
            obj1[key] = obj2[key];
        }
    }
}
