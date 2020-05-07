let clients=[];

function processRequest(msg){
	 //{request:{action:INIT_CONNECTION, fromIP:null, reqId:<hash>}}
	let action=getAction(msg.action);
	let req = msg.data.request;
	if(typeof(req.fromIP)==="undefined"||!isValidIP(req.fromIP)){
		wsSend({action:ACTION_RESPONSE,response:{"status":ERR_OFFER_REJECTED,reason:ERR_IP_NOT_ON_WHITELIST, forIP:"undefined", reqId:req.reqId}});
		return;
	}
	
	switch(action){
		case ACTION_INIT_CONNECTION:
			
			break;
		case ACTION_INIT_WRCONN:
			console.log("TBD: processRequest> init wrconn");
			buildConnection(req);
			break;
		case ACTION_WRCONN_NEXT:
			console.log("DBG: processRequest> wr connext");
			if(req.status==WR_SDP_ANSWER){completeConnection(req);}
			if(req.status==WR_ICE_EXCHG){processICE(req)};
			break;
		default:
			console.log("TBD: processRequest",action);
		
	}
	
}

function notifyDC(evt,details,name){
	switch(evt){
		case DC_OPEN:
			//when this opens, we need to start processing video
			upgradeToVideo(details);
			break;
		case DC_CLOSE:
		
			break;
		case DC_MSG:
			console.log("TBD: notifyDC",DC_MSG,"of length",details.data.length,name);
			finalizeVideo(details,name);
			break;
	}
	
}

function finalizeVideo(details,dcName){
	let client = getClient(dcName+"-out");
	let parsed=isActionMsg(details);
	console.log("DBG: finalizeVideo>",parsed);
	if(parsed){
		let remoteSDP = new RTCSessionDescription(parsed.data.response.sdp);
		client.videoPC.setRemoteDescription(remoteSDP)
		.then(function() {
			console.log("TBD exchange ICE");
			//callerObj.exchangeICE=true;
			//exchangeICE(callerObj,callerObj.chName);
		})
		.catch(function(reason) {
			// An error occurred, so handle the failure to connect
			console.log(reason);
		});
	}
}

function getClient(name){
	console.log("TBD: getClient",clients,name);
	let client;
	clients.forEach(cl=>{
		cl.connObjs.forEach(co=>{
			if(co.chName+"-out"==name) client=cl;			
		});
	});
	//let client = clients.find(cl=>{return typeof(cl.connObjs.find(co=>co.chName+"-out"==name))==="undefined";});
	return client;
}

function upgradeToVideo(dc){
	let client = getClient(dc.label);
	navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(function(localStream) {
      document.getElementById("local_video").srcObject = localStream;
	  hndVideo.localStream=localStream;
	  hndVideo.errLocal=false;
     // localStream.getTracks().forEach(track => myPeerConnection.addTrack(track, localStream));
    })
	.then(function(){
		let videoPC = new RTCPeerConnection();
		client.videoPC=videoPC;
		for (const track of hndVideo.localStream.getTracks()) {
			videoPC.addTrack(track);
		}
		videoPC.createOffer()
			.then(function(offer) {
				return videoPC.setLocalDescription(offer);
			})
			.then(function() {
				dc.send(JSON.stringify({action:ACTION_WR_VID_INIT,
									data:{
											response:{
											  type: "video-offer",
											  sdp: videoPC.localDescription
											}
									}
								  }));
			})
			.catch(function(e){
				  console.log("ERR:",e);
			});
		
	})
    .catch(function(e){
		console.log("ERR:",e);
		hndVideo.errLocal=true;
	});
	
}

function processICE(req){
	let client = clients.find(cl=>cl.ip==req.fromIP);
	if(client){
		let conn=client.connObjs.find(co=>co.chName==req.chName);
		if(conn){
			setICECandidates(conn.callerPC,req.iceList);
		}
	}
	//setICECandidates(wrtcConn,ice);
}

function processClientSet(){
	console.log("INFO: Client set", "Do nothing on Alice");	
}

function getAction(act){
	if(typeof(act)==="undefined") return ACTION_UNDEF;
	switch(act){
		//case ACTION_INIT_CONNECTION:
		case ACTION_INIT_WRCONN:
		case ACTION_WRCONN_NEXT:
		//case	
			return act;
			break;
		
	}
	console.log("ERR: Undefined requested action",act);
	return ACTION_UNDEF;
	
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

function buildConnection(req){
	let obj = {ip:req.fromIP,chName:"dc-"+req.fromIP+"-"+req.reqId, callerPC:null, callerDC:null, ice:{candidates: [],exchanged:[]},exchangeICE:false};
	let client=clients.filter(c=>c.ip==req.fromIP);
	if(client.length==0){
		clients.push({ip:req.fromIP,connObjs:[obj]});
	}
	else{
		client.connObjs.push([obj]);
	}
	createOffer(obj);
}

function completeConnection(req){
	let client = clients.find(cl=>cl.ip==req.fromIP);
	let conn = client.connObjs.find(co=>co.chName==req.chName);
	console.log("DBG: completeConnection",client,conn);
	conn.remoteSDP=req.offer;
	finalizeSession(conn);
	
}

function sendToServer(content){
	//{response:{status:SDP_OFFER,offer:SDPOfferString, forIP:<ip>}}
	/*
	name: callerObj.chName,
				target: callerObj.fromIP, //this is an identifier that uniquely identifes the remote peer
				type: "datachannel",
				sdp: callerPC.localDescription
	*/
	console.log("DBG: sendToServer>",content);
	if(content.state==WR_SDP_OFFER){
		wsSend({action:ACTION_WRCONN_NEXT,
					data:{
							response:{
									"status":WR_SDP_OFFER,
									chName:content.name,
									offer:content.sdp,
									forIP:content.target
								}
						}
				});
	}
	if(content.state==WR_ICE_EXCHG){
		let msg={action:ACTION_WRCONN_NEXT,
					data:{
							response:{
									"status":WR_ICE_EXCHG,
									chName:content.name,
									forIP:content.forIP,
									iceList:content.ice
								}
						}
				};
		console.log(msg);
		wsSend(msg);
	}
	
}