var spawn = require('child_process').spawn;
var readline = require('readline');
var express = require('express');

var lastLoad = new Date().getTime();
var fileListing = [];
var latestRenders = [];

function randomIntFromInterval(min,max) {
  return Math.floor(Math.random()*(max-min+1)+min);
}

var args = [
  "/home/pi/pictures/",
  //"/home/pi/test/",
  "-name",
  "'*.jpg'",
  "-o",
  "-name",
  "'*.JPG'"
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

app.use('/images', express.static('/home/pi/pictures'));

app.get('/rand', (req, res) => {
  lastLoad = new Date().getTime();
  var index = randomIntFromInterval(0, fileListing.length);
  try {
    res.send(fileListing[index].replace('/home/pi/pictures/', ""));
  } catch(ex) {
    res.end();
    console.log("Exception trying to fetch file: ", ex, index);
  }
})

app.get('/alive', (req, res) => {
  res.end("" + ((new Date().getTime() - lastLoad) < 65000));
});

app.get('/', function (req, res) {
  res.sendFile('/home/pi/server/index.html');
})

app.get('/shell', function (req, res) {
  res.sendFile('/home/pi/server/shell.html');
})

app.get('/recent', (req, res) => {
  var lenOfLatest = latestRenders.length;
  res.write(JSON.stringify(latestRenders.slice(lenOfLatest - 10, lenOfLatest + 1)));
});

app.listen(8080, function () {
  console.log('App listening on port 8080!')
})
