
const WS_STATUS = "ws status";
const WS_STATUS_AVAILABLE = "ws available";
const WS_STATUS_INIT = "ws initializing";
const WS_STATUS_ERR = "ws error";
const WS_STATUS_OPEN = "ws open";
const WS_STATUS_MSG = "ws msg";
const WS_STATUS_CLOSE = "ws close";
const WS_STATUS_RETRY = "ws retry";
const WS_STATUS_PAGE_UNLOAD = "ws close as page is unloading";

const WS_CLIENT_IS_GENERIC = "generic ws client";
const WS_CLIENT_IS_ALICE = "ws client alice";
const WS_CLIENT_IS_EVE = "ws client eve";

const WS_ACTION_SET_CLIENT_TYPE = "ws set client";
const WS_ACTION_WRCONN_INIT = "ws initiate wr conn";
const WS_ACTION_FAILED_ERROR="ws requested action failed";
const WS_ACTION_CLOSE_CONN = "ws closing connection";

const WR_ACTION_FAILED_ERROR="wr requested action failed";
const WR_ACTION_CONN_NEXT = "Next step of WR connection";
const WR_ACTION_DC_MSG ="wr data ch process received msg";
const WR_ACTION_REQ_VIDEO="wr request video";

const ERR_ALICE_UNAVAILABLE="Alice is not connected";
const ERR_IP_NOT_ON_WHITELIST="IP not on whitelist";
const ERR_OFFER_REJECTED="WR Offer Rejected";

//we wont be retrying overall... just refresh the page

let defaultWSConfig = {wsAddress:"ws://localhost:1337", wsClientType:WS_CLIENT_IS_GENERIC};

function websocketInit(config){
	if ("WebSocket" in window){//check if browser supports ws
		console.log("INFO: websocketInit>WebSocket is supported by your Browser!");
		updateDOM(WS_STATUS,{evt:WS_STATUS_AVAILABLE});
		
		if(typeof(config.wsAddress)==="undefined") config.wsAddress = defaultWSConfig.wsAddress;
		if(typeof(config.wsClientType)==="undefined") config.wsClientType = defaultWSConfig.wsClientType;
		console.log("INFO: websocketInit>WebSocket setup to: ",config.wsAddress," as ",config.wsClientType);
		
		// Let us open a web socket
		try{
			config.ws = new WebSocket(config.wsAddress);
			updateDOM(WS_STATUS,{evt:WS_STATUS_INIT});
			let ws = config.ws; //temp handle
			ws.onerror = function (evt){//error
				//console.log("DBG: wsOnerror>",evt);
				updateDOM(WS_STATUS,{evt:WS_STATUS_ERR, evtData:"WS Connection interrupted with: "+evt.type});
				if(ws.readyState==2||ws.readyState==3){
					updateDOM(WS_STATUS,{evt:WS_STATUS_CLOSE});
				}
			}
			
			ws.onopen = function(){
			// Web Socket is connected, send data using send()
				updateDOM(WS_STATUS,{evt:WS_STATUS_OPEN});
				if(config.greet){
					wsSend(config.greeting);
				}
			};

			ws.onmessage = function (msgEvent){ 
				//console.log("DBG: websocketInit>msgEvent");
				if(msgEvent.data!=null){
					let msgObj = JSON.parse(msgEvent.data);
					notifyData(msgObj);
					updateDOM(WS_STATUS,{evt:WS_STATUS_MSG,evtData:msgEvent.data.length});					
				}
			};

			ws.onclose = function(){
				// websocket is closed.
				console.log("ERROR: websocketInit>Websocket Connection Closed");
				updateDOM(WS_STATUS,{evt:WS_STATUS_CLOSE});
				/*config.lastStatus = WS_STATUS_CLOSED;
				window.setTimeout(function(){//try reconnecting after 5 seconds
					updateDOM(WSSTATUS,{stat:WS_STATUS_RECONNECT});
					config.lastStatus = WS_STATUS_RECONNECT;
					websocketInit(config);
				}, 5000);*///no recoonection
			};
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
		wsSend({action:WS_ACTION_CLOSE_CONN,data:{reason:WS_STATUS_PAGE_UNLOAD}}); //tell server, closing connection
		wsConfig.ws.close();
	}
}

function wsSend(msgObj){
	//console.log("DBG: wsSend>",msgObj);
	if(wsConfig.ws.readyState==1){
		wsConfig.ws.send(JSON.stringify(msgObj));
	}
	else{
		console.log("ERR: Socket not open");		
		updateDOM(WS_STATUS,{evt:WS_STATUS_ERR, evtData:"Socket is closed"});
	}	
}

//part of our event-based communication between specific core functionalities
//this approach allows these shared functions to exist irrespective of which core files are combined
if(typeof updateDOM === "undefined"){
	updateDOM = function(name, details) {//this is a abstracted form of DOM updateCommands
	//the event will trigger, but if there are no listeners, it just vaporizes.
		let event = new CustomEvent("DOMUpdate", {
			detail: {"name":name, "details":details}
		});
		document.dispatchEvent(event);
	}
}

if(typeof notifyData === "undefined"){
	notifyData = function (data){
		let event = new CustomEvent("DataEvent",{
			detail: data
		});
		document.dispatchEvent(event);
	}
}