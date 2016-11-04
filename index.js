const express = require('express');
const bodyParser = require ('body-parser');
const path = require('path');
const app = express();
const fs = require('fs');
const JSONStream = require('json-stream');
const jsonStream = new JSONStream();
const pods = fs.readFileSync("pods.json");
const podJson = JSON.parse(pods);
const sleep = require('sleep');

const server = app.listen(9003, () => {
    console.log('Listening on *:9003');
})

const io = require ('socket.io')(server);

const K8Api = require('kubernetes-client');

const options = {
  url: 'http://127.0.0.1:8090',
  version: 'v1',  // Defaults to 'v1' 
  namespace: 'default' // Defaults to 'default' 
}

const k8 = new K8Api.Core(options);

function getKubeStream() {

  const stream = k8.ns.po.get({ qs: { watch: true } });
  stream.pipe(jsonStream);
  jsonStream.on('data', object => {

    switch(object.type) {
      case 'ADDED':
        var pod = {
          name: object.object.metadata.name 
        }
        console.log(pod.name + " Added");
        io.emit('newPod' , pod);
        break;
      case 'DELETED':
        var pod = {
          name: object.object.metadata.name 
        }
        console.log(pod.name + " Deleted");
        io.emit('removePod' , pod);
        break;
      default:
      console.log("Differnet state - " + object.object.kind + " was " + object.type);
    }
  });
}

function fetchPods(err, result) {
  if (err){
    console.log("Cannot connect to Kubernetes")
    err;
  } else {
    const items = result.items;
    var pods = {};
    podList = Array.from(items, i => ({name: i.metadata.name}) );
    podsResponse = { podList };
    console.log(podsResponse);
    // Sometimes this event fires too quickly, lets sleep for a half second
    sleep.sleep(1);
    io.emit('initPod' , podsResponse);
    console.log("sent pod init");
  }
}



app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket) {
    socket.on('sniffPods', function() {
      console.log("Got sniff pods command");
      k8.ns.po.get(fetchPods);
    });
    socket.on('k8sDestroyPod', function(data) {
      console.log(data); 
      k8.ns.po.delete(data.name, (err) => {
        if(err) {
          err;
        } 
      });
    })
});

getKubeStream(); 
