var spawn = require('child_process').spawn;
var readline = require('readline');
var express = require('express');
var fs = require('fs');
var path = require('path')


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

function getExif(file, cb) {
  let args = [
    " ",
    "-json",
    "\"/home/pi/" + file + "\""
  ];

  let child = spawn('exiftool', args, {'shell':true});

  let rl = readline.createInterface({
    input: child.stdout
  });

  let exifData = "";
  rl.on('line', (data) => {
    exifData += data;
  });

  child.on('close', (code) => {
    let exifObj = {};
    try {
      exifObj = JSON.parse(exifData)[0];
    } catch(ex) { console.log("Error parsing data: ", exifData); }

    cb(exifObj);
  });
}

app.get('/exif', (req, res) => {
  var file = req.query.file;
  getExif(file, (metadata) => {
    let dateObj = metadata.MediaCreateDate;
    if (!dateObj) {
      dateObj = metadata.DateTimeOriginal;
    }
    if (dateObj && dateObj != "") { dateObj = dateObj.split(/ /); };
    res.end(JSON.stringify({orientation: (metadata.Orientation ? metadata.Orientation : 1), date: dateObj}));
  });
});

function getRot(file, deg, cb) {
  let args = [
    " ",
    "-rotate",
    deg,
    "\"/home/pi/" + file + "\"",
    "\"/home/pi/server/rotated/tmp"+ path.extname(file) + "\""
  ];

  let child = spawn('convert', args, {'shell':true});
  console.log("convert" + args.join(" "))

  child.on('close', (code) => {
    cb(args[4].replace(/"/g,""));
  });
}

app.get('/rot', (req, res) => {
  var file = req.query.file;
  var deg = req.query.deg;
  getRot(file, deg, (newFile) => {
    console.log("Sending along: ", newFile);
    res.sendFile(newFile);
  });
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
app.get('/s', function (req, res) {
  res.sendFile('/home/pi/server/saved.html');
})

function uniq(a) {
  return Array.from(new Set(a));
}

app.get('/recent', (req, res) => {
  console.log(latestRenders);
  res.write(JSON.stringify(uniq(latestRenders).slice(0, 100)));
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

process.on('uncaughtException', (err) => {
  console.log(`Caught exception: ${err}\n`);
});
