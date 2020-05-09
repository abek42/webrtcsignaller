let wsConfig= {wsClientType:WS_CLIENT_IS_ALICE,greet:true,greeting:{action:WS_ACTION_SET_CLIENT_TYPE,data:{type:WS_CLIENT_IS_ALICE}}};
let wrConfig={clients:[]};	
let vidConfig={isReady:false,mediaConstraints:{audio: true, video: true}};

function processClientSet(){
	console.log("INFO: Client set", "Do nothing on Alice");	
}

function processWRInitRequest(msg){
/*
	Alice checks if request fromIP is a valid IP, 
		If not
			Alice sends to Dory {action:ACTION_WR_DENIED,response:{status:OFFER_REJECTED,reason:IP_NOT_ON_WHITELIST, forIP:<ip>, reqId:<hash>}}
		If valid ip
			Alice creates an RTCPeerConnection object.
			Alice creates an offer (an SDP session description) with the RTCPeerConnection createOffer() method.
			Alice calls setLocalDescription() with this offer.
			Alice stringifies the offer 
			Alice sends stringified offer to Dory {response:{status:SDP_OFFER,offer:SDPOfferString, forIP:<ip>}}
*/
	let req=msg.data;
	if(typeof(req.fromIP)==="undefined"||!isValidIP(req.fromIP)){
		wsSend({action:WR_ACTION_FAILED_ERROR,data:{"requestedAction":msg.action,"msg":ERR_IP_NOT_ON_WHITELIST,"error":ERR_OFFER_REJECTED}});
		return;
	}

//if here, valid ip
	let idx=wrConfig.clients.findIndex(c=>c.ip==req.fromIP);;
	if(idx==-1){
		wrConfig.clients.push({ip:req.fromIP,connObjs:[]});
		idx = wrConfig.clients.length-1;
	}
	let client=wrConfig.clients[idx];
	
	let connCfg={pc:null,reqId:req.reqId,
				 ice:{
						newICE:[],exchangedICE:[],exchange:false
					 },
				 channels:[],ip:req.fromIP,client:"client"+idx+"_",
				 hndVidCfg:vidConfig,addVideo:false,createDC:true
				};
	client.connObjs.push(connCfg);//save it for later
	buildConnection(connCfg,signallerWS,false);
	
}

function processWRConnNext(msgObj){
	switch(msgObj.data.step){
		case WR_SDP_ANSWER:
			let cfg = wrConfig.clients.find(cl=>cl.ip==msgObj.data.fromIP).connObjs.find(co=>co.reqId==msgObj.data.reqId);
			completeConnection(cfg,msgObj.data.sdp,signallerWS);
			break;
		case WR_ICE_EXCHG:
			let cfgICE = wrConfig.clients.find(cl=>cl.ip==msgObj.data.fromIP).connObjs.find(co=>co.reqId==msgObj.data.reqId);
			setICECandidates(cfgICE.pc,msgObj.data.ice);
		default:
			console.log("TBD: processWRConnNext>pending",msgObj.data.step,msgObj.data);
		
	}
}

