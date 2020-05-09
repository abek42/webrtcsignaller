
setDOMUpdateListener();
setDataEvtListener();

function setDebugDiv(){
	//$("reload").html(JSON.stringify(Date()).split("+")[0]);
	document.getElementById("reload").innerHTML = JSON.stringify(Date()).split("+")[0];
}

function setDOMUpdateListener(){//this is meant to encapsulate DOM changes in response to non-DOM events
	document.addEventListener("DOMUpdate", function(e) {
		processDOMUpdate(e.detail);//this function should be updated to work on customized changes
	});
}

function setDataEvtListener(){//this is meant to encapsulate DOM changes in response to non-DOM events
	document.addEventListener("DataEvent", function(e) {
		processDataMsg(e.detail);//this function should be updated to work on customized changes
	});
}

function processDOMUpdate(msg){
	switch(msg.name){
		case WS_STATUS:
			processWSMsg(msg.details); break;
		case WR_STATUS:
			processWRMsg(msg.details); break;
		default:
			console.log("TBD: processDOMUpdate>",msg.name,msg);
	}
}

function processWRMsg(details){
	console.log("TBD: processWRMsg",details);
	
	/*
	onst WR_STATUS_PC="wr pconn created";
const WR_STATUS_WR_INIT="request to setup wr";
const WR_STATUS_ICE_FOUND="wr ice found";
const WR_STATUS_ICE_EXCHG="wr ice sent";
const WR_STATUS_SDP_LOCAL="wr set local SDP";
const WR_STATUS_SDP_REMOTE="wr set sdp remote";
const WR_STATUS_DC_OPEN="wr data ch open";
const WR_STATUS_DC_CLOSED="wr data ch closed";
const WR_STATUS_DC_MSG="wr data ch received msg";

client0_wr_init" class="tile gray">WR</span>
		<span id="client0_wr_pc" class="tile gray">PC</span>
		<span id="client0_wr_ice_found" class="tile gray">ICE</span>
		<span id="client0_wr_ice_exchg" class="tile gray">Exch</span>
		<span id="client0_wr_sdp_local" class="tile gray">SDP-Alice</span>
		<span id="client0_wr_sdp_remote" class="tile gray">SDP-Eve</span>
		<span id="client0_wr_dc" class="tile gray">DC</span>
		<span id="client0_wr_dcmsg
	*/
	let hnd=details.evtData;
	let domHnd;
	let grayAlt="green";
	switch(details.evt){
		case WR_STATUS_WR_INIT: 
			hnd+="wr_init"; break;
		case WR_STATUS_PC:
			hnd+="wr_pc"; break;
		case WR_STATUS_SDP_LOCAL:
			hnd+="wr_sdp_local"; break;
		case WR_STATUS_SDP_REMOTE:
			hnd+="wr_sdp_remote"; break;
		
		
		/*case WS_STATUS_ERR:
			hnd="main_websocket_errWS";
			grayAlt="red";
			console.log("DBG: processWSMsg> err: ",details);
			document.getElementById("main_websocket_errmsgWS").innerHTML=details.evtData;
			break;*/
		case WR_STATUS_ICE_FOUND:
			hnd+="wr_ice_found"; 
			grayAlt="silver";
			//trigger anim behaviour
			animLabel(hnd);		
			break;
		case WR_STATUS_ICE_EXCHG:
			hnd+="wr_ice_exchg"; 
			grayAlt="silver";
			//trigger anim behaviour
			animLabel(hnd);		
			break;
		case WR_STATUS_DC_OPEN:
			hnd+="wr_dc";
			break;
		case WR_STATUS_DC_CLOSED:
			hnd+="wr_dc";
			grayAlt="red"
			break;
		case WR_STATUS_DC_MSG:
			hnd+="wr_dcmsg";
			grayAlt="silver";
			//trigger anim behaviour
			animLabel(hnd);
			break;
			
		/*case WS_STATUS_CLOSE:
			hnd="main_websocket_closeWS";
			grayAlt="red";
			break;		
		case WS_STATUS_RETRY:
			document.getElementById("main_websocket_errmsgWS").innerHTML=details.evtData;
			hnd="main_websocket_errWS";
			document.getElementById(hnd).classList.remove("red");
			grayAlt="gray";
			break;*/
		default:
			console.log("TBD: processWRMsg>",details.evt);
			return;
	}
	domHnd=document.getElementById(hnd);
	domHnd.classList.remove("gray");
	if(!domHnd.classList.toString().includes(grayAlt)) domHnd.classList.add(grayAlt);
	
}

function animLabel(hnd){
	//trigger anim behaviour
	let	domHnd = document.getElementById(hnd);
		
	let removeCl="anim1"; let addCl="anim2";
	if(!domHnd.classList.toString().includes("anim1")){
		removeCl="anim2";
		addCl = "anim1";
	}
	domHnd.classList.remove(removeCl);
	void domHnd.offsetWidth;
	domHnd.classList.add(addCl);
}

function processDataMsg(msgObj){
	console.log("DBG: processDataMsg>",msgObj);
	switch(msgObj.action){
		case WS_ACTION_SET_CLIENT_TYPE:
			processClientSet(msgObj.data);
			break;
		case WS_ACTION_FAILED_ERROR:
			processWSMsg({evt:WS_STATUS_ERR,evtData:msgObj.data.error+" : "+msgObj.data.msg,src:"processDataMsg"});//show the error to UI
			processRecovery(msgObj);
			break;
		case WS_ACTION_WRCONN_INIT:
			processWRInitRequest(msgObj);
			break;
		case WR_ACTION_CONN_NEXT:
			processWRConnNext(msgObj);
			break;
		default:
			console.log("TBD: processDataMsg> pending action",msgObj.action);
	}
}

function processRecovery(msg){
	//see if we can recover from the issue
	console.log("DBG: processRecovery>",msg, msg.data.requestedAction);
	switch(msg.data.requestedAction){
		case WS_ACTION_WRCONN_INIT:
			retryConnection(msg);
			break;
		default:
			console.log("TBD: processRecovery>",msg.data.requestedAction,msg);
	}
	
}

function processWSMsg(details){
	let hnd="";
	let domHnd;
	let grayAlt="green";
	switch(details.evt){
		case WS_STATUS_AVAILABLE: 
			hnd="main_websocket_hasWS"; break;
		case WS_STATUS_INIT:
			hnd="main_websocket_initWS"; break;
		case WS_STATUS_ERR:
			hnd="main_websocket_errWS";
			grayAlt="red";
			console.log("DBG: processWSMsg> err: ",details);
			document.getElementById("main_websocket_errmsgWS").innerHTML=details.evtData;
			break;
		case WS_STATUS_OPEN:
			hnd="main_websocket_openWS"; break;
		case WS_STATUS_MSG:
			//console.log("DBG: processWSMsg>WS_STATUS_MSG",details);
			hnd="main_websocket_msgWS"; 
			grayAlt="silver";
			
			//trigger anim behaviour
			domHnd = document.getElementById(hnd);
			domHnd.innerHTML="Msg [ "+details.evtData+" ]";
			let removeCl="anim1"; let addCl="anim2";
			if(!domHnd.classList.toString().includes("anim1")){
			 removeCl="anim2";
			 addCl = "anim1";
			}
			domHnd.classList.remove(removeCl);
			void domHnd.offsetWidth;
			domHnd.classList.add(addCl);			
			
			break;
		case WS_STATUS_CLOSE:
			hnd="main_websocket_closeWS";
			grayAlt="red";
			break;		
		case WS_STATUS_RETRY:
			document.getElementById("main_websocket_errmsgWS").innerHTML=details.evtData;
			hnd="main_websocket_errWS";
			document.getElementById(hnd).classList.remove("red");
			grayAlt="gray";
			break;
	}
	domHnd=document.getElementById(hnd);
	domHnd.classList.remove("gray");
	if(!domHnd.classList.toString().includes(grayAlt)) domHnd.classList.add(grayAlt);	
}

function signallerWS(obj){
	let sendObj = {action:obj.wrAction,
					data:{
							step:obj.wrStep,
							forIP:obj.target,
							reqId:obj.reqId,
							sdp:(obj.wrStep==WR_SDP_OFFER||obj.wrStep==WR_SDP_ANSWER)?obj.sdp:"",
							ice:obj.wrStep==WR_ICE_EXCHG?obj.ice:""
						 }
				   };
	wsSend(sendObj);
}

function signallerWRDC(obj,dc){
	let sendObj = {action:obj.wrAction,
					data:{
							step:obj.wrStep,
							forIP:obj.target,
							reqId:obj.reqId,
							sdp:(obj.wrStep==WR_SDP_OFFER||obj.wrStep==WR_SDP_ANSWER)?obj.sdp:"",
							ice:obj.wrStep==WR_ICE_EXCHG?obj.ice:""
						 }
				   };
		dc.send(JSON.stringify(sendObj));	
}

function uuidv4() {//https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function isActionMsg(msg){
	try{
		let actionMsg=JSON.parse(msg.data);
		if(actioMsg.action) return actioMsg;
	}
	catch(e){
		console.log("INFO: isActionMsg>parse failed",e);
		return false;
	}
}

function isValidIP(ip){
	//assuming a ipv4 local LAN
	let spl=ip.split(".");
	//
	//::ffff:192.168.1.3
	if(spl.length!=4) return false;
	let rechunk=[spl[0],spl[1]*1,spl[2]*1].join(".");
	if(rechunk!="::ffff:192.168.1"&&rechunk!="192.168.1") return false;
	return true; //we don't check for last mask of being between 0-255, leaving it as TBD
}