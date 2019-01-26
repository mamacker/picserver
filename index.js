var spawn = require('child_process').spawn;
var readline = require('readline');
var express = require('express');
var ExifImage = require('exif').ExifImage;
var fs = require('fs');
var exiftool = require('exiftool');

var lastLoad = new Date().getTime();
var index = 0;
var paused = false;
var fileListing = [];
var latestRenders = [];
var indexes = [];

function randomIntFromInterval(min,max) {
  return Math.floor(Math.random()*(max-min+1)+min);
}

var args = [
  "/home/pi/",
  //"/home/pi/test/",
  "-name",
  "'*.jpg'",
  "-o",
  "-name",
  "'*.JPG'",
  "-o",
  "-name",
  "'*.gif'",
  "-o",
  "-name",
  "'*.GIF'",
  "-o",
  "-name",
  "'*.png'",
  "-o",
  "-name",
  "'*.mov'",
  "-o",
  "-name",
  "'*.MOV'",
  "-o",
  "-name",
  "'*.mp4'",
  "-o",
  "-name",
  "'*.MP4'",
  "-o",
  "-name",
  "'*.PNG'"
];

// Give the pi some time to boot.
setTimeout(() => {
  child = spawn('find', args, {'shell':true});
  console.log("find " + args.join(" "))

  var rl = readline.createInterface({
    input: child.stdout
  });

  rl.on('line', (data) => {
    fileListing.push(data);
  });

  child.on('close', (code) => {
    console.log("Number of files: " + fileListing.length);
    console.log(fileListing[0]);
  });
}, 30000);


var app = express()

app.use('/images', express.static('/home/pi'));

setInterval(() => {
  if (!paused) {
    index = randomIntFromInterval(0, fileListing.length);

    var fileName = fileListing[index];
    // If its a kaylie picture... try again.
    if (fileName && fileName.match(/.*kaylie.*/i)) index = randomIntFromInterval(0, fileListing.length);
    indexes.unshift(index);
    indexes.length = 100;
    console.log("New Index:", index);
  }
}, 10000);

app.get('/rand', (req, res) => {
  lastLoad = new Date().getTime();
  try {
    var fileName = fileListing[index];
    if (fileName) fileName = fileName.replace('/home/pi/', "");
    res.send(fileName);
    latestRenders.unshift(fileName);
    latestRenders.length = 100;
  } catch(ex) {
    res.end();
    console.log("Exception trying to fetch file: ", ex, index);
  }
})

app.get('/exif', (req, res) => {
  var file = req.query.file;
  if (file.match(/.*.(mp4|mov)/i)) {
    fs.readFile("/home/pi/" + file, function (err, data) {
      if (err) {
        console.log('Error: ', err);
        res.end("" + 1);
      }

      try {
        exiftool.metadata(data, function (err, metadata) {
          if (err) {
            console.log('Error in movie: ',err);
            console.log("Has exif tool been installed?: sudo apt-get install exiftool");
            res.end("" + 1);
            return;
          }
          let dateObj = metadata.mediaCreateDate;
          if (dateObj && dateObj != "") { dateObj = dateObj.split(/ /); };
          res.end(JSON.stringify({orientation: 1, date: dateObj}));
        });
      } catch(ex) {
        console.log("Exception in exif: ", ex);
      }
    });
  } else {
    new ExifImage({ image : "/home/pi/" + file }, function (error, exifData) {
      if (error) {
        console.log('Error: '+error.message);
        res.end("" + 1);
      } else {
        console.log(exifData.image.Orientation); // Do something with your data!
        let dateObj = exifData.exif.DateTimeOriginal;
        if (dateObj && dateObj != "") { dateObj = dateObj.split(/ /); };
        res.end(JSON.stringify({orientation: exifData.image.Orientation, date: dateObj}));
      }
    });
  }
});

app.get('/alive', (req, res) => {
  res.end("" + ((new Date().getTime() - lastLoad) < 65000));
});

app.get('/', function (req, res) {
  res.sendFile('/home/pi/server/index.html');
})

app.get('/shell', function (req, res) {
  res.sendFile('/home/pi/server/shell.html');
})

app.get('/r', function (req, res) {
  res.sendFile('/home/pi/server/recent.html');
})

function uniq(a) {
  return Array.from(new Set(a));
}

app.get('/recent', (req, res) => {
  console.log(latestRenders);
  res.write(JSON.stringify(uniq(latestRenders).slice(0, 20)));
  res.end();
});

pauseTimeout = 0;
app.get('/pause', (req, res) => {
  console.log("Paused!!");
  paused = true;
  clearTimeout(pauseTimeout);
  pauseTimeout = setTimeout(() => {
    paused = false;
  }, 30000);
});

app.get('/back', (req, res) => {
  if (indexes.length > 2) 
    index = indexes[indexes.length - 2]
  console.log("Back! New index: ", index, indexes.length);
});

app.listen(8080, function () {
  console.log('App listening on port 8080!')
})

var http = require('http');
http.createServer(app).listen(80);
