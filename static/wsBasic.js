let wsObj = {	wsAddress:"ws://localhost:1337", 
				wsClientId:null, wsClientType:null,
				wsPeer:null, 
				handle:null,msgs:0, 
				lastStatus:null,  
				timerHnd:null, 
				msgDigested:true};

const ACTION_BROADCAST ="broadcast";
const ACTION_SEND_TO_PEER = "send to peer";
const ACTION_CONNECT = "connect";
const ACTION_RECONNECT = "reconnect";
const ACTION_DISCONNECT = "disconnect";
const ACTION_SET_CLIENT = "set client id";
const ACTION_WS_INIT = "web socket initializing";

const ACTION_MSG = "client msg";
const ACTION_WS_CLOSE = "closing on page unload";
const EVENT_WS_OPEN = "connection open";
const EVENT_WS_ERR = "disconnected with error";
const EVENT_WS_MSG = "inbound message";
const WSSTATUS = "wsStatus";
const WS_STATUS_INIT = "WS Initializing";
const WS_STATUS_OPEN = "WS Open";
const WS_STATUS_ERR = "WS Error";
const WS_STATUS_CLOSED = "WS Closed";
const WSEVENT = "wsEvent";

const CLIENT_IS_LISTENER_BROADCAST ="broadcast listener";
const CLIENT_IS_LISTENER_PEER = "peer listener";
const CLIENT_IS_SENDER_BROADCAST = "broadcast sender";
const CLIENT_IS_SENDER_PEER = "peer sender";
const CLIENT_IS_DUPLEX_BROADCAST = "broadcast sender-listener";
const CLIENT_IS_DUPLEX_PEER = "peer sender-listener";


//handle all the websocket initialization and connection handling
function websocketInit(config){
	if ("WebSocket" in window){//check if browser supports ws
		console.log("INFO: WebSocket is supported by your Browser!");
		if(wsObj.lastStatus==null){
			updateDOM(WSSTATUS,{stat:WS_STATUS_INIT});
		}
		//update wsAddress
		wsObj.wsAddress = typeof(config.wsAddress)==="undefined"?wsObj.wsAddress:config.wsAddress;
		wsObj.wsClientType=typeof(config.clientType)==="undefined"?wsObj.wsClientType:config.clientType; //save for future use
		// Let us open a web socket
		try{
			var ws = new WebSocket(wsObj.wsAddress);
			ws.onerror = function (evt){
				updateDOM(WSEVENT,{evt:EVENT_WS_ERR, evtData:evt.error});
				updateDOM(WSSTATUS,{stat:WS_STATUS_ERR});
				wsObj.lastStatus = WS_STATUS_ERR;
			}
			
			ws.onopen = function(){
			// Web Socket is connected, send data using send()
				ws.send(JSON.stringify({"action":ACTION_CONNECT, "type":config.type}));
				
				console.log("INFO: WebSocket INIT");
				updateDOM(WSEVENT,{evt:EVENT_WS_OPEN,evtData:"open"});
				updateDOM(WSSTATUS,{stat:WS_STATUS_OPEN});
				wsObj.lastStatus = WS_STATUS_OPEN;
			};

			ws.onmessage = function (msgEvent){ 
				if(wsObj.msgDigested){
					//when wsObj.msgDigested=true we drop packets if we get them faster than we can process them
					var msgObj = JSON.parse(msgEvent.data);
					
					if(msgObj.data!=null){
						wsObj.msgDigested = false;
						wsObj.msgs++;
						notifyData(msgObj.data);
						updateDOM(WSEVENT,{evt:EVENT_WS_MSG,evtData:msgObj});
					}
					
				}
			};

			ws.onclose = function(){
				// websocket is closed.
				console.log("ERROR: Websocket Connection Closed");
				updateDOM(WSSTATUS,{stat:WS_STATUS_CLOSED});
				wsObj.lastStatus = WS_STATUS_CLOSED;
				window.setTimeout(function(){//try reconnecting after 5 seconds
					updateDOM(WSSTATUS,{stat:WS_STATUS_RECONNECT});
					wsObj.lastStatus = WS_STATUS_RECONNECT;
					websocketInit(config);
				}, 5000);
			};
			wsObj.handle = ws; //reference to the actual websocket			
		}
		catch(e){
			console.log("ERR: Catch", e);
		}
	}            
	else{
		// The browser doesn't support WebSocket
		alert("WebSocket NOT supported by your Browser!");
	}
	
	window.onbeforeunload = function(){
		ws.send(JSON.stringify({action:ACTION_WS_CLOSE})); //tell server, closing connection
		ws.close();
	}
}

function wsSend(data){
	if(wsObj.lastStatus==WS_STATUS_OPEN){
		wsObj.handle.send(JSON.stringify({action:ACTION_MSG,"data":data}));
	}
	else{
		console.log("ERR: Socket not open");		
	}
}

function updateDOM(name, details) {//this is a abstracted form of DOM updateCommands
//the event will trigger, but if there are no listeners, it just vaporizes.
	console.log("DBG: updateDOM",name, details);
	var event = new CustomEvent("DOMUpdate", {
		detail: {"name":name, "details":details}
	});
	document.dispatchEvent(event);
}

function notifyData(data){
	var json = JSON.parse(data);
	var event = new CustomEvent("DataEvent",{
		detail: data
	});
	document.dispatchEvent(event);
	wsObj.msgDigested = true;
}
