var yt = require('youtube-feeds');
var prompt = require('prompt');
var createMenu = require('terminal-menu');
var playlister = require('./playlists');
var fs = require('fs');
var childProcess = require('child_process');
var path = require('path');
var colors = require('colors');
var ProgressBar = require('progress');

prompt.message = '';
prompt.delimiter = '';
prompt.colors = false;
prompt.start();

//clear screen
clearScreen();

//ask user for search
prompt.get([{
    name: 'q',
    required: true,
    description: 'Search for > '.green
}], function(err, results) {
    if (err) throw err;
    playlister(results, parseLists);
});

function parseLists(playlists) {
    //show options to the client
    var titles = playlists.map(function(pl) {
        return pl.title[0];
    });
    //client selects
    showMenu(titles, function(label) {
        var playlist = playlists[Number(label)];

        //download
        getPlaylist(playlist);
    });
}

var downloadFolder = 'downloads'; //placeholder name
function showMenu(titles, cb) {

    var menu = createMenu({
        width: 60,
        x: 4,
        y: 2
    });

    menu.write('SELECT PLAYLIST');
    menu.write('\n---------------\n');

    titles.forEach(function(title) {
        //TODO: add some more stats for the playlist!
        menu.add(title);
    });

    menu.on('select', function(title, label) {
        downloadFolder = title;
        menu.close();
        cb(label);
    });

    clearScreen();

    menu.createStream().pipe(process.stdout);

}

function getPlaylist(playlist) {
    //id > 'yt:playlistId'

    var id = playlist['yt:playlistId'][0];
    var total = Number(playlist['yt:countHint'][0]);
    var videos = [];
    var maxResults = 50; //youtube api max

    var options = {
        'max-results': maxResults,
        'orderBy': 'published',
        'start-index': 1
    };

    get();

    function get() {
        yt.feeds.playlist(id, options, function(error, data) {
            if (error) throw error;
            //get all videos for playlist
            videos = videos.concat(data.items);
            if (total > options['start-index'] + 49) {
                options['start-index'] += maxResults;
                get();
            } else {
                parseVideos(videos);
            }
        });
    }
}


function parseVideos(videos) {

    //id = data[]>video.id
    //title = data[]>video.title
    var vids = videos.map(function(vid) {
        return {
            title: vid.video.title,
            id: vid.video.id
        };
    });

    // console.log('Got %d videos', vids.length);
    // fs.writeFile('./videos.json', JSON.stringify(vids), function(err) {
    //     if (err) throw err;
    //     console.log('saved videos.json');
    // });

    //remove menu
    clearScreen();

    //make the download folder first!
    fs.mkdir(path.join(__dirname, downloadFolder), function() {
        // timer = setInterval(++duration, 1000);
        downloadVids(vids, 0, end);
    });
}
var duration = 0;
// var timer;
var children = [];

function downloadVids(videos, counter, cb) {
    if (counter >= videos.length) {
        return cb();
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
        downloadVids(videos, ++counter, cb);
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


//TODO: need to add a date checker to warn user youtube api v2 is going to be depracated
