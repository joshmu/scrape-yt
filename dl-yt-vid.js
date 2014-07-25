var ytdl = require('ytdl-core');
var fs = require('fs');
var path = require('path');
var Notification = require('node-notifier');
var notifier = new Notification();

var videoUrl = process.argv[2];
var downloadPath = process.argv[3];
//TODO: will video download still work if mp4 is not available?
var options = {
    filter: function(format) {
        return format.container === 'mp4';
    }
};

var write_stream = fs.createWriteStream(downloadPath);

var readable_stream = ytdl(videoUrl, options);

//send data to file
readable_stream.pipe(write_stream);

var size = 0;
var buffSize = 0;

var videoInfo;
var duration = 0;
var timer;
var perc;

readable_stream
//ytdl custom event
.on('info', function(infoObj) {
    videoInfo = infoObj;
    //find the first object which has a 'container' of 'mp4' then grab the size
    //using 'some' to do this. hacky?
    infoObj.formats.some(function(format){
        if(format.container === 'mp4') {
            size = format.size;
            process.send({
                type: 'size',
                val: Number(size)
            });
            //break out of loop
            return true;
        }
    });
    process.send({
        type: 'info',
        val: infoObj
    });
    timer = setInterval(function() {
        duration = ++duration;
    }, 1000);

})
//standard nodejs readable stream events
.on('readable', function() {
    //there is some data to read now
})
    .on('data', function(chunk) {
        //piping instead
        buffSize += chunk.length;
        var newPerc = ((buffSize / size) * 100).toFixed(1);
        // console.log('%d%', perc);
        if (perc !== newPerc) {
            perc = newPerc;
            process.send({
                type: 'completion',
                val: perc
            });
        }
    })
    .on('end', function() {
        //stop timer
        clearInterval(timer);
        process.send({
            type: 'duration',
            val: duration
        });
        notify();
    });

function notify() {
    notifier.notify({
        title: videoInfo.title,
        subtitle: 'Download complete.',
        message: duration + ' seconds.',
        sound: 'Funk'
    }, function(err) {
        if (err) throw err;
    });
}
