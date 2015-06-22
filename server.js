var dgram = require('dgram');
var http = require('http');
var path = require('path');
var fs = require('fs');
var WebSocketServer = require('websocket').server;
var StringDecoder = require('string_decoder').StringDecoder;

var mime = require('./mime.json');
var config = require('./config.json');

var udpPort = 1234;
var udpHost = '0.0.0.0';

var httpPort = 8080;
var httpHost = '0.0.0.0';

var decoder = new StringDecoder('utf8');

var webSocketConnections = [];

var data = [];

var purgeInterval = 3600*1000;

var dataInterval = 3600*24;

/*
 * UDP Server
 */
var udpServer = dgram.createSocket('udp4');

udpServer.on('listening', function() {
  var address = udpServer.address();
  console.log('UDP server listening on ' + address.address  +
    ':' + address.port);
});

udpServer.on('message', function(message, remote) {

  var text = decoder.write(message).replace(/(\r\n|\n|\r)/gm, '');

  console.log("[" + webSocketConnections.length + "] " + text);

  webSocketConnections.forEach(function(conn) {
    if (conn.state == 'open') {
      conn.sendUTF(text);
    }
  });

  try {
    data.push(JSON.parse(text));
  } catch (e) {
    console.log("Unable to parse JSON object.");
  }
});

udpServer.bind(udpPort, udpHost);

/*
 * HTTP Server
 */
var httpServer = http.createServer(handleHttpRequest);

httpServer.listen(httpPort, httpHost);
console.log('HTTP server listening on ' + httpHost + ':' + httpPort);

/*
 * WebSocket Server
 */
var wsServer = new WebSocketServer({ httpServer : httpServer });

wsServer.on('request', handleWebSocketRequest);

/*
 * Handlers
 */
function handleHttpRequest(req, res) {

  var filePath = path.join(config.documentRoot, req.url);

  filePath += req.url.slice(-1) == '/' ? 'index.html' : '';

  var ext = filePath.substring(filePath.lastIndexOf('.')+1, filePath.length);

  var contentType = mime[ext];

  fs.readFile(filePath, function(error, content) {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end('Page not found.\n');
      } else {
        res.writeHead(500);
        res.end('Oops! Error: '+error.code+'.\n');
      }
    } else {
      res.writeHead(200, { 'Content-Type' : contentType });
      res.end(content, 'utf-8');
    }
  });
}

function handleWebSocketRequest(request) {

  var connection = request.accept(null, request.origin);

  webSocketConnections.push(connection);

  console.log('WebSocket request from: ' + request.remoteAddress);

  connection.on('message', handleWebSocketMessage(connection)); 

  connection.on('close', handleWebSocketClose);

  // Send stored data
  data.forEach(function(d) {
    connection.sendUTF(JSON.stringify(d));
  });
}

function handleWebSocketMessage(connection) {

  return function(message) {

    var json = {};

    if (message.type != "utf8") {
      console.log("Unsupported message data format.");
      return;
    }

    try {
      json = JSON.parse(message.utf8Data);
    } catch (e) {
      console.log("Unable to parse JSON.");
    }

    if (typeof json.cmd !== "undefined") {
      switch(json.cmd) {
        case 'restart':
        default:
          // Send stored data
          data.forEach(function(d) {
            connection.sendUTF(JSON.stringify(d));
          });
          break;
      }
    }
  }
}

function handleWebSocketClose(connection) {
  // close user connection
  webSocketConnections.forEach(function(conn, i) {
    // Remove connection
    if (connection.remoteAddress == conn.removeAddress) {
      webSocketConnections.splice(i, 1);
    }

    // Also remove closed connections
    if (conn.state != 'open') {
      webSocketConnections.splice(i, 1);
    }
  });
}

function purgeData() {

  var currentTimestamp = parseInt(Date.now()/1000);

  while (data[0].ts < currentTimestamp - dataInterval) {
    data.splice(0, 1);
  }

  setTimeout(purgeData, purgeInterval);
}

setTimeout(purgeData, purgeInterval);
