const fs = require("fs");
const net = require('net');
const WebSocketServer = require('websocket').server;
const http = require('http');
const express = require('express');
const util= require('util');
const os = require('os');
const path = require('path');

var wsStatus = {port:1337, externalIP:true, noHTTP:false, httpPort:3000 ,browserClients:[],  serverIP:[]};

runServer();

function runServer(){
	wsInit();
	if(!wsStatus.noHTTP) initHTTPServer();
}



function wsInit(){//this is the websocket part which allows data from the LSL Inlet Stream to be pumped to a browser page
	var server = http.createServer(function(request, response) {
		// process HTTP request. Since we're writing just WebSockets server
		// we don't have to implement anything.
		enumObject(request);
	});
	
	server.listen(wsStatus.port, function() {//this is the port which serves the data 
		getIP(wsStatus.serverIP);
		console.log("INFO: WebSocket Server operating on: "+wsStatus.serverIP[0]+":"+wsStatus.port);
	});
	server.on("error",function(e){
		if(e.errno==='EADDRINUSE'){
			console.log("ERR: Requested Websocket Port:", wsStatus.port, " is already in use.");
			process.exit(0);
		}
	});

	// create the server
	wsServer = new WebSocketServer({
		httpServer: server,
		autoAcceptConnections: false
	});

	wsServer.on('request', function(request) {
	   //we only allow local connections, default choice
		if(isAllowedIP(request.remoteAddress)){//set wsStatus.externalIP = true when a second device is expected to connect
			console.log("INFO: Incoming WS connection from: " +request.remoteAddress);
		}        
		else{
			console.log("ERR: Rejecting WS connection request from remote client:"+request.remoteAddress);
			var connection = request.reject(102, 'Remote Connection Request Denied. Server only allows local-machine IPs');
			return;
		}
	   
		var connection = request.accept(null, request.origin);// create the connection
		
		var index =wsStatus.browserClients.push(connection)-1; //save it for later use
		
		// all messages from users are handled here
		connection.on('message', function(message) {
			if (message.type === 'utf8') {
				// process WebSocket message
				console.log("INFO: WS Client Message>", message.utf8Data);
				process(message);
			}
		});

		connection.on('close', function(connection) {
			// close user connection
			var client = (typeof(wsStatus.browserClients[index])!=="undefined")? wsStatus.browserClients[index].remoteAddress:"";
			console.log("WARN: Client: "+ client + " on WS "+connection.toString() + " disconnected");
			wsStatus.browserClients.splice(index, 1);
		});
	});
}


function process(msg){
	console.log("TBD:process: ",msg);	
}


//acquire the IP address of the server 
function getIP(ip){
	//required to identify the server's IP
	var interfaces = os.networkInterfaces();
	Object.keys(interfaces).forEach(function (interfaceName) {
		var alias = 0;

		interfaces[interfaceName].forEach(function (_interface) {
			if ('IPv4' !== _interface.family || _interface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}

			if (alias >= 1) {
				// this single interface has multiple ipv4 addresses
				//console.log(ifname + ':' + alias, iface.address);
				ip.push(_interface.address);
			} else {
				// this interface has only one ipv4 adress
				//console.log(ifname, iface.address);
				ip.push(_interface.address);
			}
			++alias;
		});
	});
}

//if external IPs are disabled, we don't allow messages from there.
function isAllowedIP(ip){
	//console.log("INFO: Allowed IP check:",wsStatus.externalIP, ip);
	return wsStatus.externalIP||(ip=="::1")||(ip=="::ffff:127.0.0.1");
}

function initHTTPServer(){//this is needed to let browsers request the basic WS Connection Page
	//setup the server using express
	var httpServer = express();
	httpServer.use(function(req, res, next){//basic debug function
		//console.log('INFO: %s %s from %s , proxy: %s', req.method, req.url, req.ip, util.inspect(req.ips));
		next();
	});
	//order is important...
	httpServer.use(allowExternalIP); //middleware function to check if we want to block external IPs (abuse risk)
	
	httpServer.get('/', function(req, res) {//serve for the default http://localhost/ call
		res.sendFile(path.join(__dirname + '/static/wsBasic.html'));
	});

	httpServer.use(express.static('static')); //serve static files from the html directory on subsequent named gets	
	
	httpServer.listen(wsStatus.httpPort); //true http server, get it rolling.
	console.log("INFO: HTTP Server Port: "+wsStatus.httpPort);
}

// here the middleware function, it filters by ip, if ip is clean, call next callback.
function allowExternalIP (req, res, next) {
	if(isAllowedIP(req.ip)){
		next();
	}        
	else{
		console.log("WARN: Rejected",req.ip, " To allow access restart with -X flag.");
		res.status(403).end('');
	}
}