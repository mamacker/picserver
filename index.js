var spawn = require('child_process').spawn;
var readline = require('readline');
const FauxMo = require('node-fauxmo');
var express = require('express');
var fs = require('fs');
var path = require('path')

var lastLoad = new Date().getTime();
var index = 0;
var paused = false;
var fileListing = [];
var latestRenders = [];
var indexes = [];

let water = "off";
let dogdoor = "open";
let sentry = "off";
let wizards_fire = "off";
setTimeout(() => {
  console.log("Starting outlet for water heater and dogdoor.");
  let fauxMo = new FauxMo({
    ipAddress: "192.168.1.33",
    devices: [{
        name: 'water_heater',
        port: 11000,
        handler: (action) => {
          console.log('Water heater action:', action);
          water = (action == 1 ? "on" : "off")
        }
      },{
        name: 'dog_door',
        port: 11001,
        handler: (action) => {
          console.log('Dog door action:', action);
          dogdoor = (action == 1 ? "open" : "closed")
        }
      },{
        name: 'dog_door_toggle',
        port: 11002,
        handler: (action) => {
          console.log('Dog door toggle action:', action);
          if (action == 1) { 
            dogdoor = "toggle";
            setTimeout(() => { dogdoor = "open"}, 2000);
          }
        }
      },{
        name: 'sentry',
        port: 11004,
        handler: (action) => {
          console.log('Sentry turret action:', action);
          sentry = (action == 1 ? "open" : "closed")
        }
      },{
        name: 'wizards_fire',
        port: 11003,
        handler: (action) => {
          console.log('Wizards fire:', action);
          wizards_fire = (action == 1 ? "on" : "off")
        }
      }
    ]
  });
}, 10000);

function randomIntFromInterval(min,max) {
  return Math.floor(Math.random(Math.random())*(max-min+1)+min);
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
app.use('/static', express.static('/home/pi/server/static'));

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
app.get('/o', function (req, res) {
  res.sendFile('/home/pi/server/old.html');
})
app.get('/s', function (req, res) {
  res.sendFile('/home/pi/server/saved.html');
})

app.get('/water', (req, res) => {
  if (req.query.set) {
    water = "on";
  } else if (req.query.clear) {
    water = "off";
  }
  res.end(water);
})

app.get('/sentry', (req, res) => {
  if (req.query.set) {
    sentry = "on";
  } else if (req.query.clear) {
    sentry = "off";
  }
  res.end(sentry);
})

app.get('/dogdoor', (req, res) => {
  if (req.query.open) {
    dogdoor = "open";
  } else if (req.query.close || req.query.closed) {
    dogdoor = "closed";
  } else if (req.query.toggle) {
      dogdoor = "toggle";
      setTimeout(() => { dogdoor = "open"}, 4000);
  }
  res.end(dogdoor);
})

app.get('/wizardsfire', (req, res) => {
  if (req.query.on || req.query.set) {
    wizards_fire = "on";
  } else if (req.query.off || req.query.clear) {
    wizards_fire = "off";
  }
  res.end(wizards_fire);
})
app.get('/wizards_fire', (req, res) => {
  if (req.query.on || req.query.set) {
    wizards_fire = "on";
  } else if (req.query.off || req.query.clear) {
    wizards_fire = "off";
  }
  res.end(wizards_fire);
})

let isOccupied = false;
app.get('/occupied', (req, res) => {
  if (req.query.set !== undefined) {
    if (req.query.set === "1") {
      isOccupied = "on";
    } else if (req.query.set === "0") {
      isOccupied = "off";
    }
  }
  console.log("Area is occupied?", isOccupied);
  res.end(isOccupied);
})

let curUrl = "";
let rotateTimer = null;
app.get('/seturl', function (req, res) {
  curUrl = req.query.url;
  clearTimeout(rotateTimer);
  res.end("set.");
})

app.get('/currenturl', function (req, res) {
  res.end(curUrl);
})

app.get('/rotateurl', function (req, res) {
  res.end("rotating");
  let urlList = [
    ["https://www.youtube.com/embed/Q6Iqev-E150?list=tLppquNnqg8Yg2FLtBGI1pynHd_kTBfP9N&autoplay=1&loop=1&index=1", 10 * (60 * 1000)],
    ["https://www.youtube.com/embed/DXUAyRRkI6k?list=tLppquNnqg8Yg2FLtBGI1pynHd_kTBfP9N&autoplay=1&loop=1&index=1", 4 * (60 * 1000)],
    ["https://www.youtube.com/embed/XXZFco-1zpo?list=tLppquNnqg8Yg2FLtBGI1pynHd_kTBfP9N&autoplay=1&loop=1&index=1", 5 * (60 * 1000)],
    ["https://www.youtube.com/embed/63QyMlUzMA0?list=tLppquNnqg8Yg2FLtBGI1pynHd_kTBfP9N&autoplay=1&loop=1&index=1", 10 * (60 * 1000)],
    ["https://www.youtube.com/embed/BnrSY8GpMjU?list=tLppquNnqg8Yg2FLtBGI1pynHd_kTBfP9N&autoplay=1&loop=1&index=1", 10 * (60 * 1000)],
    ["https://www.youtube.com/embed/BnrSY8GpMjU?list=tLppquNnqg8Yg2FLtBGI1pynHd_kTBfP9N&autoplay=1&loop=1&index=1", 10 * (60 * 1000)],
  ];

  let playlistIndex = -1;
  clearTimeout(rotateTimer);

  let playIt = () => {
    playlistIndex++;
    if (playlistIndex >= urlList.length) {
      playlistIndex = 0;
    }
    rotateTimer = setTimeout(playIt, urlList[playlistIndex][1]);
    curUrl = urlList[playlistIndex][0];
  }
  playIt();
});

function uniq(a) {
  return Array.from(new Set(a));
}

app.get('/recent', (req, res) => {
  console.log(latestRenders);
  res.write(JSON.stringify(uniq(latestRenders).slice(0, 20)));
  res.end();
});

app.get('/old', (req, res) => {
  console.log(latestRenders);
  res.write(JSON.stringify(uniq(latestRenders).slice(0, 140)));
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
