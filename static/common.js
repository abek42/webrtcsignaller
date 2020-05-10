const ACTION_INIT_CONNECTION="WR INIT CONN";
const ACTION_UNDEF="WR Undefined Action";
const ACTION_WS_CONNECT="WS INIT CONN";
const ACTION_RESPONSE="Respond";
const ACTION_REQUEST="Request";

const ACTION_INIT_WRCONN = "Init WR Connection";
const ACTION_WRCONN_NEXT = "Next step of WR connection";
const ACTION_WS_CLIENT_SET="Client set";
const ACTION_WS_FAILED="Action WS failed";
const ACTION_WR_FAILED="Action WR failed";
const ACTION_WR_VID_INIT="Action to upgrade to video";


const CLIENT_IS_ALICE ="alice";
const CLIENT_IS_EVE = "eve";

const ERR_ALICE_UNAVAILABLE="Alice is not connected";
const ERR_IP_NOT_ON_WHITELIST="IP not on whitelist";
const ERR_OFFER_REJECTED="WR Offer Rejected";
const WR_SDP_OFFER="SDP Offer";
const WR_SDP_ANSWER="SDP Answer";
const WR_ICE_EXCHG="ICE Exchange";
const WSEVENT = "wsEvent";
const WREVENT = "wrEvent";
const WRDCOPENEVENT= "wr DC channel open";
const DC_OPEN="dc open";
const DC_CLOSE="dc close";
const DC_MSG ="dc message";

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
		processMessage(e.detail);//this function should be updated to work on customized changes
	});
}

function processDOMUpdate(eventDetails){	
	//normally, we assume that there is a single span with the name to which the update lands in
	let hndID = eventDetails.name==WREVENT?eventDetails.details.id:eventDetails.name;
	let hnd = document.getElementById(hndID);
	console.log("DBG: processDOMUpdate>",hndID,eventDetails.name,hnd);
	if(typeof(hnd)==="undefined"||hnd==null){//doesn't exist
		hnd = document.createElement('span'); 				//create a span
		hnd.id = hndID;							//set it's id for future use
		let dbg=document.getElementById("debug")
		dbg.appendChild(hnd); 	//add the new span to the debug-div
		dbg.appendChild(document.createElement("br"));
		console.log(eventDetails,hnd);
	}
	switch(eventDetails.name){
		case WSSTATUS:
			hnd.innerHTML = eventDetails.details.stat;					//add the actual message
			break;
		case WSEVENT:
			hnd.innerHTML = eventDetails.details.evt;
			break;
		case WREVENT:
			hnd.innerHTML = eventDetails.details.innerHTML;
			break;
		default:
			hnd.innerHTML = eventDetails.details;
			console.log("TBD: ",eventDetails.name, eventDetails);
	}
}

function processMessage(msgObj){
	console.log("DBG: processMessage",msgObj);
	
	switch(msgObj.action){
		case ACTION_WS_CLIENT_SET:
			processClientSet();
			break;
		default:
			console.log("TBD: processMessage>",msgObj.action);
	}
	
	if(msgObj.data.request){
		processRequest(msgObj);
		return;
	}
	
	if(msgObj.data.response){
		processResponse(msgObj);		
	}
	/*
	**Alice connects to DORY
		Alice opens WS connection to Dory
		Once connected, Alice sends message {action:ACTION_WS_CONNECT, clientType:CLIENT_IS_ALICE}
	**Dory receive message from Alice
		Dory sets Alice's clientType to CLIENT_IS_ALICE
		Dory responds with {action:ACTION_WS_CLIENT_SET,to:CLIENT_IS_ALICE}
			Errors: If invalid or duplicated actions, errors are sent back with ACTION_WS_FAILED
	**Eve requests to see Alice's webcam 
		Eve sets WS address of Dory
		Eve opens WS connection to Dory
		Once connected, Eve sends message {action:ACTION_WS_CONNECT, clientType:CLIENT_IS_EVE}
	**Dory receives message from Eve
		Dory sets Eve's clientType to CLIENT_IS_EVE
		Dory responds with {action:ACTION_WS_CLIENT_SET,to:CLIENT_IS_EVE}
			Errors: If invalid or duplicated actions, errors are sent back with ACTION_WS_FAILED
		Eve builds a request {action:ACTION_INIT_WRCONN, data:{request:{fromIP:null, reqId:<hash>}}}
		Eve sends request to Dory over WS
	**Dory receives request from Eve
		Dory performs filter checks for IP request
		Dory checks if Alice is connected
		If Alice is not connected
			Send Eve {action:ACTION_WR_FAILED,data:{status:OFFER_FAILED,reason:ALICE_NOT_ONLINE}}
		If Alice is connected
			Dory inserts fromIP value into the request
			Dory forwards request to Alice
	**Alice receives request from Dory  {action:ACTION_INIT_WRCONN, data:{request:{fromIP:<ip>, reqId:<hash>}}}
		Alice checks if request fromIP is a valid IP, 
		If not
			Alice sends to Dory {action:ACTION_WR_DENIED,response:{status:OFFER_REJECTED,reason:IP_NOT_ON_WHITELIST, forIP:<ip>, reqId:<hash>}}
		If valid ip
			Alice creates an RTCPeerConnection object.
			Alice creates an offer (an SDP session description) with the RTCPeerConnection createOffer() method.
			Alice calls setLocalDescription() with this offer.
			Alice stringifies the offer 
			Alice sends stringified offer to Dory {response:{status:SDP_OFFER,offer:SDPOfferString, forIP:<ip>}}
	**Dory forwards response to Eve based on forIP
    **Eve receives response
		Eve checks if response is SDP_OFFER
		If not
			Eve shows status and reason to Eve's viewer
		If yes
			Eve extracts Alice's offer
			Eve calls setRemoteDescription() with Alice's offer, 
			Eve calls createAnswer(), and the success callback for this is passed a local session description: Eve's answer.
			Eve sets her answer as the local description by calling setLocalDescription().
			Eve stringifies answer as {request:{status:SDP_ANSWER,offer:SDPOfferString,reqID:<hash>,fromIP:<>}}
			Eve sends this to Dory
	**Dory receives request from Eve
		Dory performs filter checks for IP request
		Dory checks if Alice is connected
		If Alice is not connected
			Send Eve {respose:{status:OFFER_FAILED,reason:ALICE_NOT_ONLINE}}
		If Alice is connected
			Dory inserts fromIP value into the request
			Dory forwards request to Alice
	**Alice recieves message from Dory
		Alice checks if request fromIP is a valid IP, 
		If not
			Alice sends to Dory {response:{status:OFFER_REJECTED,reason:IP_NOT_ON_WHITELIST, forIP:<ip>, reqId:<hash>}}
		If valid ip
			Alice sets Eve's answer as the remote session description using setRemoteDescription().
	**Alice and Eve exchange ICE candidates similarly
	**Now Alice creates a new RTCPeerConnection object with a media track
	**Alice shares the connection info over the existing RTCPeerConn>DataChannel
	
	*/
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
		if(actionMsg.action) return actionMsg;
	}
	catch(e){
		console.log("INFO: isActionMsg>parse failed",e);
		return false;
	}
}

//--------------------video stream handler----------------------//
var mediaConstraints = {
  audio: true, // We want an audio track
  video: true // ...and we want a video track
};

let hndVideo={localStream:null,remoteStream:null,errLocal:false};

function getLocalStream() {
    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(function(localStream) {
      document.getElementById("local_video").srcObject = localStream;
	  hndVideo.localStream=localStream;
	  hndVideo.errLocal=false;
     // localStream.getTracks().forEach(track => myPeerConnection.addTrack(track, localStream));
    })
    .catch(function(e){
		console.log("ERR:",e);
		hndVideo.errLocal=true;
	});
}