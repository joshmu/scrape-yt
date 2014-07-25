'use strict';

/* youtube api v2 expiry */
var expiry = new Date(2015, 3, 20);
if(expiry.getTime() < new Date().getTime()) {
    throw new Error('This module relies heavily on YouTube Data API v2 which will has been deprecated on April 20th 2015 to be replaced by version 3 of their API. =(');
}

/*==============================================================================
=            download all youtube videos from a playlist or channel            =
==============================================================================*/
/**
*
* App: scrape-yt
* Author: Josh Mu
* Created: 25/07/2014
*
**/

var yt = require('youtube-feeds');
var prompt = require('prompt');
var createMenu = require('terminal-menu');
var searchYoutube = require('./search');
var fs = require('fs');
var childProcess = require('child_process');
var path = require('path');
var colors = require('colors');
var ProgressBar = require('progress');
var q = require('q');

prompt.message = '';
prompt.delimiter = '';
prompt.colors = false;
prompt.start();

//clear screen
clearScreen();

//download channel or playlist
var type;

//setup a promise chain
var defer = q.defer();

//ask user for search
prompt.get([{
    name: 'q',
    required: true,
    description: 'Search for > '.green
}, {
    name: 'type',
    required: true,
    description: 'Playlist or channel?'.green
}], function(err, results) {
    if (err) {
        defer.reject(err);
    }
    type = results.type;     //store type of download selection
    defer.resolve(results);
});

//flow of events
defer.promise
    .then(searchYoutube)
    .then(parseList)
    .then(showMenu)
    .then(getSelection)
    .then(playlistOrChannel)
    .then(parseVideos)
    .then(function(vids){
        fs.writeFile('./test4.json', JSON.stringify(vids), function(){
            console.log('saved');
        });
    })
    .then(downloadSetup)
    .then(function(vids) {
        var defer = q.defer();
        downloadVids(vids, 0, defer);
        return defer.promise;
    })
    .then(end)
    .then(null, console.error)
    .done();


// store query results
var queryResults;

function parseList(items) {
    queryResults = items;
    return queryResults.map(function(i) {
        return i.title[0];
    });
}

function playlistOrChannel(item) {
    return type === 'playlist' ? getPlaylist(item) : getChannel(item);
}

var total;
function getChannel(item) {
    var defer = q.defer();

    var userId = item.author[0]['yt:userId'][0];
    var options = {
        'max-results': 50, //yt api max
        // 'orderby': 'published', //this cause error when exceeding 500 entries
        'start-index': 1
    };
    var videos = [];

    (function get() {
        yt.user(userId).uploads(options, function(err, data) {
            total = data.totalItems;
            if (err) {
                defer.reject(err);
            }
            //get all videos for playlist
            videos = videos.concat(data.items);
            if (total > options['start-index'] + 49) {
                options['start-index'] += options['max-results'];
                get();
            } else {
                defer.resolve(videos);
            }
        });
    })();
    return defer.promise;
}

function getSelection(index) {
    return queryResults[Number(index)];
}

var downloadFolder = 'downloads'; //placeholder name
function showMenu(titles) {
    var defer = q.defer();

    var menu = createMenu({
        width: 60,
        x: 4,
        y: 2
    });

    menu.write('SELECT ' + type.toUpperCase());
    menu.write('\n---------------\n');

    titles.forEach(function(title) {
        //TODO: add some more stats for the playlist!
        menu.add(title);
    });

    menu.on('select', function(title, index) {
        downloadFolder = title;
        menu.close();
        defer.resolve(index);
    });

    clearScreen();

    menu.createStream().pipe(process.stdout);

    return defer.promise;
}


function getPlaylist(playlist) {
    var defer = q.defer();
    //id > 'yt:playlistId'

    var id = playlist['yt:playlistId'][0];
    total = Number(playlist['yt:countHint'][0]);
    var videos = [];
    var maxResults = 50; //youtube api max

    var options = {
        'max-results': maxResults,
        'orderby': 'published',
        'start-index': 1
    };

    (function get() {
        yt.feeds.playlist(id, options, function(error, data) {
            if (error) {
                defer.reject(error);
            }
            //get all videos for playlist
            videos = videos.concat(data.items);
            if (total > options['start-index'] + 49) {
                options['start-index'] += maxResults;
                get();
            } else {
                defer.resolve(videos);
            }
        });
    })();
    return defer.promise;
}


function parseVideos(videos) {
    //id = data[]>video.id
    //title = data[]>video.title
    var vids;
    //slight inconsitency in response data =(
    if (type === 'playlist') {
        vids = videos.map(function(vid) {
            return {
                title: vid.video.title,
                id: vid.video.id
            };
        });
    } else {
        vids = videos.map(function(vid) {
            return {
                title: vid.title,
                id: vid.id
            };
        });
    }

    // console.log('Got %d videos', vids.length);
    // fs.writeFile('./test3.json', JSON.stringify(vids), function(err) {
    //     if (err) throw err;
    //     console.log('saved videos.json');
    // });
    return vids;
}

function downloadSetup(vids) {
    var defer = q.defer();
    //remove menu
    clearScreen();

    //stat init
    console.log('Downloading %d videos > %s'.red, total, downloadFolder);

    //make the download folder first!
    fs.mkdir(path.join(__dirname, downloadFolder), function() {
        // timer = setInterval(++duration, 1000);
        defer.resolve(vids);
    });
    return defer.promise;
}




var duration = 0;
// var timer;
var children = [];

function downloadVids(videos, counter, defer) {
    if (counter >= videos.length) {
        return defer.resolve();
    }
    var vid = videos[counter];
    var vidInfo; //will get this info when child sends it
    var url = 'https://www.youtube.com/watch?v=' + vid.id;
    var downloadPath = path.join(__dirname, downloadFolder, vid.title + '.mp4');
    var args = [url, downloadPath];
    var child = childProcess.fork(path.join(__dirname, 'vid.js'), args);
    children.push(child);

    var completion;
    var bar;
    child.on('message', function(m) {
        if (m.type === 'info') {
            vidInfo = m.val;
            console.log('\n %s'.green, vidInfo.title);
            bar = setupProgressBar();
        } else if (m.type === 'completion') {
            // console.log('%d%'.red, m.val);
            if (completion !== m.val) {
                completion = m.val;
                if (completion % 1 === 0 && completion !== 0) {
                    bar.tick();
                }
            }
        } else if (m.type === 'duration') {
            duration += m.duration;
            // console.log('Downloaded >'.green + ' %s'.blue + ' in %d seconds', m.title, m.duration);
        }
    });

    child.on('exit', function() {
        downloadVids(videos, ++counter, defer);
    });
}


process.on('exit', function() {
    children.forEach(function(child) {
        child.kill();
    });
});

function setupProgressBar() {
    return new ProgressBar('[:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        total: 100
    });
}

function end() {
    console.log('Playlist downloaded in %d seconds.'.green, duration);
    // clearInterval(timer);
    // console.log('Playlist downloaded in %d seconds', duration);
}

function clearScreen() {
    //clear screen & place cursor at 0,0.
    process.stdout.write('\u001B[2J\u001B[0;0f');
}


//TODO: is there a way to send values as individual arguments in promises