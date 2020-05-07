let requesterID=uuidv4();
let wrtcConn = {};

function setWSIP(){
	let ip = window.location.hostname;
	console.log("DBG: setWSIP",ip);
	
	let wsIP = "ws://"+ip+(":1337");
	wsObj.wsAddress= wsIP;
	websocketInit({clientType:CLIENT_IS_EVE});
	document.getElementById("setIP").disabled=true;
}

function notifyDC(evt,details,dc){
	switch(evt){
		case DC_OPEN:
			//when this opens, we need to start processing video
			//upgradeToVideo(details);
			break;
		case DC_CLOSE:
		
			break;
		case DC_MSG:
			console.log("DBG: notifyDC>",DC_MSG,"of length",details.data.length);
			let parse=isActionMsg(details);
			if(parse){
				upgradeToVideo(parse,dc);
			}
			break;
	}
}	

function upgradeToVideo(action,dc){
	console.log("TBD: processUpgrade",action);
	let videoPC = new RTCPeerConnection();
	var desc = new RTCSessionDescription(action.data.response.sdp);
	
	videoPC.setRemoteDescription(desc)
		.then(function() {
			return videoPC.createAnswer();
		})
		.then(function(answer) {
			return videoPC.setLocalDescription(answer);
		})
		.then(function() {
			console.log("INFO: Sending video accept offer");
			dc.send(JSON.stringify({action:ACTION_WR_VID_INIT,
									data:{
										response:{
											type: "video-accept-offer",
											sdp: videoPC.localDescription
										}
									}
					}));
		})
		.catch(function(e){
			console.log("ERR:upgradeToVideo>failed",e);
		});
	/*
	  var localStream = null;

  targetUsername = msg.name;
  createPeerConnection();

  var desc = new RTCSessionDescription(msg.sdp);

  myPeerConnection.setRemoteDescription(desc).then(function () {
    return navigator.mediaDevices.getUserMedia(mediaConstraints);
  })
  .then(function(stream) {
    localStream = stream;
    document.getElementById("local_video").srcObject = localStream;

    localStream.getTracks().forEach(track => myPeerConnection.addTrack(track, localStream));
  })
  .then(function() {
    return myPeerConnection.createAnswer();
  })
  .then(function(answer) {
    return myPeerConnection.setLocalDescription(answer);
  })
  .then(function() {
    var msg = {
      name: myUsername,
      target: targetUsername,
      type: "video-answer",
      sdp: myPeerConnection.localDescription
    };

    sendToServer(msg);
  })
  .catch(handleGetUserMediaError);
	*/
	
}




function processClientSet(){
	console.log("TBD: processClientSet");	
	//{action:ACTION_INIT_WRCONN, data:{request:{fromIP:null, reqId:<hash>}}}
	wsSend({action:ACTION_INIT_WRCONN,data:{request:{fromIP:"",reqId:requesterID}}});
}

function processResponse(msg){
	console.log("TBD: processResponse",msg);
	let action=getAction(msg.action);
	if(action==ACTION_WRCONN_NEXT){
		let connStatus=msg.data.response.status;
		switch(connStatus){
			case WR_SDP_OFFER:
				processSDPOffer(msg);
				break;
			case WR_ICE_EXCHG:
				processICE(msg);
				break;
			default:
				console.log("TBD: processResponse",action,connStatus);
		}
		
	}
}

function processSDPOffer(msg){
/*		If yes, SDP_OFFER
			Eve extracts Alice's offer
			Eve processes offer
			Eve sends acceptance to Dory {request:{status:SDP_ANSWER,offer:SDPOfferString,reqID:<hash>,fromIP:<>}}
	*/
	let response = msg.data.response;
	wrtcConn = {sdpOffer:response.offer,chName:response.chName,ice:{candidates: []},exchangeICE:false,ip:"alice"};
	acceptOffer(wrtcConn);
}


function processICE(msg){
	let ice = msg.data.response.iceList;
	setICECandidates(wrtcConn.calleePC,ice);
}
//let clients=[];



function getAction(act){
	if(typeof(act)==="undefined") return ACTION_UNDEF;
	switch(act){
		case ACTION_INIT_CONNECTION:
		case ACTION_WRCONN_NEXT:
			return act;
			break;
		
	}
	console.log("ERR: Undefined requested action",act);
	return ACTION_UNDEF;
	
}

function isValidIP(ip){
	//assuming a ipv4 local LAN
	let spl=ip.split(".");
	if(spl.length!=4) return false;
	if([spl[0],spl[1],spl[2]].join(".")!="192.168.1") return false;
	return true; //we don't check for last mask of being between 0-255, leaving it as TBD
}


function sendToServer(content){
	//{response:{status:SDP_OFFER,offer:SDPOfferString, forIP:<ip>}}
	/*
	name: callerObj.chName,
				target: callerObj.fromIP, //this is an identifier that uniquely identifes the remote peer
				type: "datachannel",
				sdp: callerPC.localDescription
	*/
	//if(content.state==SDP_OFFER){
		//wsSend({response:{"status":SDP_OFFER,offer:content.sdp,forIP:content.target}});
	//}
	console.log("DBG: sendToServer>",content);
	if(content.state==WR_SDP_ANSWER){
		wsSend({action:ACTION_WRCONN_NEXT,data:{request:{"status":WR_SDP_ANSWER,chName:content.name,offer:content.sdp,forIP:content.target}}});
	}
	if(content.state==WR_ICE_EXCHG){
		wsSend({action:ACTION_WRCONN_NEXT,data:{request:{"status":WR_ICE_EXCHG,chName:content.name,iceList:content.ice,"forIP":"alice"}}});
	}
}