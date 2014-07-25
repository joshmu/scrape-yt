/*================================================
=            Download a Youtube video            =
================================================*/
'use strict';

/* modules */
var ytdl = require('ytdl-core'),
    fs = require('fs'),
    path = require('path');

/* launch if args are provided */
if (process.argv.length > 2) {
    var vid = new Vid(process.argv[2], process.argv[3]);
}

module.exports = Vid;

function Vid(vidUrl, saveTo) {
    var vid = this;

    /* download options */
    this.options = {
        filter: function(format) {
            return format.container === 'mp4';
        }
    };

    /* streams */
    var write_stream = fs.createWriteStream(saveTo),
        readable_stream = ytdl(vidUrl, this.options);
    readable_stream.pipe(write_stream);

    /* download properties */
    vid.dl = {
        size: {
            current: 0,
            total: 0
        },
        time: 0,
        completion: 0
    };

    /* events */
    readable_stream
        .on('info', function(infoObj) {
            /* ytdl custom event */
            vid.info = infoObj;
            /* iterate over 'formats' array and find the first '.mp4' file
            as this will be of the highest quality */
            vid.info.formats.some(function(format) {
                if (format.container === 'mp4') {
                    vid.dl.size.total = Number(format.size);
                    return true;
                }
            });
            /* send info */
            vid.send('size', vid.dl.size.total);
            vid.send('info', vid.info);
            /* start tracking how long it takes to download vid */
            vid.timer = setInterval(function() {
                vid.dl.time += 1;
            }, 1000);
        })
        .on('data', function(chunk) {
            /* store completion percentage */
            vid.dl.size.current += chunk.length;
            var newCompletion = ((vid.dl.size.current / vid.dl.size.total) * 100).toFixed(1);
            if (vid.dl.completion !== newCompletion) {
                vid.dl.completion = newCompletion;
                /* send info */
                vid.send('completion', vid.dl.completion);
            }
        })
        .on('end', function() {
            /* stop timer */
            clearInterval(vid.timer);
            /* send download time */
            vid.send('duration', vid.dl.time);
        });
}

/**
 * send message to parent process
 * @param  {String} type
 * @param  {Object|String|Number} val
 * @return {Function}
 */
Vid.prototype.send = function(type, val) {
    return process.send({
        type: type,
        val: val
    });
};
