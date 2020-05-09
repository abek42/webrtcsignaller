const fs = require("fs");
const net = require('net');
const WebSocketServer = require('websocket').server;
const http = require('http');
const express = require('express');
const util= require('util');
const os = require('os');
const path = require('path');

const WS_STATUS_PAGE_UNLOAD = "ws close as page is unloading";

const WS_CLIENT_IS_GENERIC = "generic ws client";
const WS_CLIENT_IS_ALICE = "ws client alice";
const WS_CLIENT_IS_EVE = "ws client eve";

const WS_ACTION_SET_CLIENT_TYPE="ws set client";
const WS_ACTION_CLOSE_CONN="ws closing connection";
const WS_ACTION_WRCONN_INIT = "ws initiate wr conn";
const WS_ACTION_FAILED_ERROR="ws requested action failed";
const WR_ACTION_CONN_NEXT = "Next step of WR connection";

const ERR_ALICE_UNAVAILABLE="Alice is not connected";
const ERR_ACTION_NOT_ALLOWED="WR action not allowed";
const ERR_CLIENT_NOT_ALLOWED="WS client type not allowed";

let wsStatus = {port:1337, externalIP:true, noHTTP:false, httpPort:3000 ,browserClients:[],  serverIP:[]};
 
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
	    let connection=null;
		if(isAllowedIP(request.remoteAddress)){//set wsStatus.externalIP = true when a second device is expected to connect
			console.log("INFO: Incoming WS connection from: " +request.remoteAddress);
		}        
		else{
			console.log("ERR: Rejecting WS connection request from remote client:"+request.remoteAddress);
			connection = request.reject(102, 'Remote Connection Request Denied. Server only allows local-machine IPs');
			return;
		}
	   
		connection = request.accept(null, request.origin);// create the connection
		
		let client = {"connection":connection, "ip":request.remoteAddress,"type":WS_CLIENT_IS_GENERIC};
		
		wsStatus.browserClients.push(client); //save it for later use
		
		// all messages from users are handled here
		connection.on('message', function(message) {
			if (message.type === 'utf8') {
				// process WebSocket message
				console.log("INFO: WS Client Message> from:",client.ip, client.type, message.utf8Data.length);
				process(message.utf8Data,client);
			}
		});

		connection.on('close', function(connection) {
			// close user connection
			console.log("DBG: Close",client.ip);
			let clientIdx = wsStatus.browserClients.findIndex(bc=>bc.ip==client.ip);
			console.log("WARN: Client: "+ client.ip + " on WS "+connection.toString() + " disconnected");
			wsStatus.browserClients.splice(clientIdx, 1);
		});
	});
}


function process(msg,client){
	console.log("TBD:process: msg from:",client.ip);
	try{
		let obj = JSON.parse(msg);
		console.log("DBG: process>","parsed", obj.action);
		switch(obj.action){
			case WS_ACTION_SET_CLIENT_TYPE:
				setClientType(obj.data.type,client);
				break;
			case WS_ACTION_WRCONN_INIT:
			case WR_ACTION_CONN_NEXT:
				processWRSignals(obj.action,obj.data,client);
				break;
			// WS_A
				/*
			case ACTION_INIT_WRCONN:
				processWRRequest(obj,client);
				break;
			case ACTION_WRCONN_NEXT:
				processWRNext(obj,client);
				break;*/
			default:
				console.log("TBD: process>Unknown action", obj.action,msg);
			
		}
	}
	catch(e){
		sendErrMsg(client.connection,"JSON Parse error",e.toString());
	}
}

function processWRSignals(action,signal,client){
	if(action==WS_ACTION_WRCONN_INIT){//initialising connection
		/*
		Dory checks if request is from Eve
		Dory checks if Alice is connected
		If Alice is not connected
			Tell Eve, Alice is not connected
		If Alice is connected
			Dory inserts fromIP value into the request
			Dory forwards request to Alice
		*/
		if(client.type!=WS_CLIENT_IS_EVE){
			sendErrMsg(client.connection,"Not allowed for this client type:"+client.type,ERR_ACTION_NOT_ALLOWED,action);
		}
		else{//client is eve, check if alice is connected
			let alice = wsStatus.browserClients.find(bc=>bc.type==WS_CLIENT_IS_ALICE);
			if(typeof(alice)==="undefined"){
				sendErrMsg(client.connection,"Alice is not connected",ERR_ALICE_UNAVAILABLE,action);
			}
			else{
				console.log("DBG: processWRSignals>",signal,JSON.stringify(signal));
				signal.fromIP=client.ip;
				sendMsg(alice.connection,action,signal);
			}
		}
		return;
	}
	if(action==WR_ACTION_CONN_NEXT){
		console.log("DBG: processWRNext",client.ip,client.type);
		if(client.type==WS_CLIENT_IS_ALICE){
			let eve = wsStatus.browserClients.find(bc=>bc.type==WS_CLIENT_IS_EVE&&bc.ip==signal.forIP);
			console.log("DBG: processWRNext> to: eve",eve.ip, signal.step);
			sendMsg(eve.connection,action,signal);
		}
		if(client.type==WS_CLIENT_IS_EVE){
			let alice = wsStatus.browserClients.find(bc=>bc.type==WS_CLIENT_IS_ALICE);
			console.log("DBG: processWRNext> to: alice",alice.ip, signal.step);
			signal.fromIP=client.ip;
			sendMsg(alice.connection,action,signal);
		}
	}
	
}
function processWRNext(obj,client){
	//**Dory forwards response to Eve based on forIP
	console.log("DBG: processWRNext",client.ip,client.type,obj);
	if(client.type==CLIENT_IS_ALICE&&obj.data.response){
		let eve = wsStatus.browserClients.find(bc=>bc.type==CLIENT_IS_EVE&&bc.ip==obj.data.response.forIP);
		console.log("DBG: processWRNext> to: eve",eve.ip, obj.data.response.status);
		sendMsg(eve.connection,obj.action,{response:obj.data.response});
	}
	if(client.type==CLIENT_IS_EVE&&obj.data.request){
		let alice = wsStatus.browserClients.find(bc=>bc.type==CLIENT_IS_ALICE);
		console.log("DBG: processWRNext> to: alice",alice.ip, obj.data.request.status);
		obj.data.request.fromIP=client.ip;
		sendMsg(alice.connection,obj.action,{request:obj.data.request});
	}
}

function processWRRequest(obj,client){
	/*Dory checks if Alice is connected
		If Alice is not connected
			Send Eve {action:ACTION_WR_FAILED,data:{status:OFFER_FAILED,reason:ALICE_NOT_ONLINE}}
		If Alice is connected
			Dory inserts fromIP value into the request
			Dory forwards request to Alice*/
	let alice = wsStatus.browserClients.find(bc=>bc.type==CLIENT_IS_ALICE);
	if(typeof(alice)==="undefined"){
		sendErrMsg(client.connection,"Alice is not connected",ERR_ALICE_UNAVAILABLE,ACTION_WR_FAILED);
	}
	else{
		obj.data.request.fromIP=client.ip;
		sendMsg(alice.connection,obj.action,{request:obj.data.request});
	}
	
}

function setClientType(type,client){
	console.log("DBG: setClientType","to: ",type,"from: ",client.type);
	if(client.type==WS_CLIENT_IS_GENERIC){//only once should this happen, attempt to redo should be rejected
		//console.log("DBG: setClientType","chk",client.type,allowClient(type));
		if(allowClient(type)){
			client.type=type;
			//console.log("DBG: setClientType","set",client.type);
			sendMsg(client.connection,WS_ACTION_SET_CLIENT_TYPE,{"state":"set",to:client.type});
		}
		else{
			console.log("DBG: disallowed",type);
			sendErrMsg(client.connection,"Client Type is disallowed: "+type,ERR_CLIENT_NOT_ALLOWED,WS_ACTION_SET_CLIENT_TYPE);
		}
	}
	else{
		//console.log("DBG: setClientType","buh",client.type);
		sendErrMsg(client.connection,"Client Type already set:"+client.type,ERR_CLIENT_NOT_ALLOWED,WS_ACTION_SET_CLIENT_TYPE);
	}
}

function allowClient(type){
	let response=false;
	switch(type){ 
		case WS_CLIENT_IS_EVE:
			response=true;
			break;
		case WS_CLIENT_IS_ALICE:
			if(wsStatus.browserClients.findIndex(bc=>bc.type==WS_CLIENT_IS_ALICE)<0) response=true;
			break;
	}
	return response;
}

function sendMsg(conn,action,msg){
	console.log("DBG: msg sent",msg);
	conn.sendUTF(JSON.stringify({"action":action,data:msg}));
}

function sendErrMsg(conn,msg,error,prevAction){
	console.log("DBG: err msg sent",prevAction,msg,error);
	conn.sendUTF(JSON.stringify({"action":WS_ACTION_FAILED_ERROR,data:{"requestedAction":prevAction,"msg":msg,"error":error}}));
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