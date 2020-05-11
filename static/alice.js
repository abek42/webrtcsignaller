let wsConfig= {wsClientType:WS_CLIENT_IS_ALICE,greet:true,greeting:{action:WS_ACTION_SET_CLIENT_TYPE,data:{type:WS_CLIENT_IS_ALICE}}};
let wrConfig={clients:[]};	
let vidConfig={isReady:false,mediaConstraints:{audio: true, video: true}};

function processClientSet(){
	console.log("INFO: Client set", "Do nothing on Alice");	
}

function getDCSuffix(chName){
	//with 
	let suffix=WR_DC_CH_NOT_FOUND;
	for(let clIdx=0;clIdx<wrConfig.clients.length;clIdx++){
		let wrClient = wrConfig.clients[clIdx];
		for(let coIdx=0;coIdx<wrClient.connObjs.length;coIdx++){
			for(let chIdx=0;chIdx<wrClient.connObjs[coIdx].channels.length;chIdx++){
					//console.log("DBG: getDCSuffix>itr>",coIdx,chIdx,wrClient.connObjs[coIdx].channels[chIdx].chName.length,chName.length,wrClient.connObjs[coIdx].channels[chIdx].chName==chName);
					if(wrClient.connObjs[coIdx].channels[chIdx].chName==chName){
						//suffix= "client"+coIdx+"_dc"+chIdx;
						return "client"+coIdx+"_dc"+chIdx;
						break;
					}
			}		
		}
	}
	console.log("DBG: getDCSuffix>for chName:",chName, " suffix:",WR_DC_CH_NOT_FOUND);
	return suffix;
}

function getDCHnd(chName){
	let dcCh=WR_DC_CH_NOT_FOUND;
	wrConfig.clients.forEach(cl=>{
		cl.connObjs.forEach(co=>{
			co.channels.forEach(ch=>{
				if(ch.chName==chName){ dcCh=ch.chHnd; return;}
			});
		});
	});
	return dcCh;
}

function processVid(vidData){
	switch(vidData.evt){
		case VID_STATUS_STREAM: //local streaming
			document.getElementById("local_video").srcObject=vidData.evtData;
			break;
		default:
			console.log("TBD: processVid",vidData.evt);
	}
	
}

function processVideoWRRequest(msg,opts){
	console.log("DBG: processVideoWRRequest>",opts,msg.data.fromIP,msg);
	let req=msg.data;
	if(!opts.ignoreIP){
		if(typeof(req.fromIP)==="undefined"||!isValidIP(req.fromIP)){
			signaller({wrAction:WR_ACTION_FAILED_ERROR,wrStep:ERR_IP_NOT_ON_WHITELIST,reqAct:msg.action,err:ERR_OFFER_REJECTED,target:req.fromIP});
			return;
		}
	}

//if here, valid ip
	//find it if it already exists
	let idx=wrConfig.clients.findIndex(c=>c.ip==req.fromIP);;
	if(idx==-1){//not found, maybe new client
		wrConfig.clients.push({ip:req.fromIP,connObjs:[]});//create new client
		idx = wrConfig.clients.length-1;
	}
	let client=wrConfig.clients[idx];//get handle to new client
	
	//create the PeerConn config object for new client and push it to list of connObjs the client has
	let connCfg={pc:null,reqId:req.reqId,
				 ice:{
						newICE:[],exchangedICE:[],exchange:false
					 },
				 channels:[],ip:req.fromIP,client:"client"+idx+"_"
				};
	client.connObjs.push(connCfg);//save it for later
	let options = {	nextAction:opts.isWSReq?WS_ACTION_WRCONN_NEXT:WR_ACTION_WRCONN_NEXT,
					signaller:opts.isWSReq?signallerWS:signallerWRDC,
					signallerDC:isUndef(opts.signallerDC)?"":opts.signallerDC,
					sdp:isUndef(opts.sdp)?false:opts.sdp,
					createDC:opts.isWSReq?true:true,
					addVideo:isUndef(opts.addVideo)?false:opts.addVideo,
					hndVidCfg:vidConfig}
	buildConnection(connCfg,options);	
	
}

function processWRInitRequest(msg,opts){
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
	console.log("DBG: processWRInitRequest>",msg);
	
	let req=msg.data;
	
	
	if(opts.isWSReq){//if from websocket, always check ip
		if(typeof(req.fromIP)==="undefined"||!isValidIP(req.fromIP)){
			//this is a WS caller, so signalling is definitely through WS
			signaller({wrAction:WR_ACTION_FAILED_ERROR,wrStep:ERR_IP_NOT_ON_WHITELIST,reqAct:msg.action,err:ERR_OFFER_REJECTED,target:req.fromIP});
			return;
		}
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
				 channels:[],ip:req.fromIP,client:"client"+idx+"_"
				};
	client.connObjs.push(connCfg);//save it for later
	let options = {	nextAction:opts.isWSReq?WS_ACTION_WRCONN_NEXT:WR_ACTION_WRCONN_NEXT,
					signaller:opts.isWSReq?signallerWS:signallerWRDC,
					signallerDC:isUndef(opts.signallerDC)?"":opts.signallerDC,
					sdp:isUndef(opts.sdp)?false:opts.sdp,
					createDC:opts.isWSReq?true:true,
					addVideo:isUndef(opts.addVideo)?false:opts.addVideo,
					hndVidCfg:vidConfig}
	buildConnection(connCfg,options);
	
}

function processWRConnNext(msgObj,opts){
	//next step in negotiation of WR-PC
	//first find the config obj containing the PC
	console.log("DBG: processWRConnNext>",msgObj);
	let cfg="";
	let options={sdp:msgObj.data.sdp,signaller:signallerWS,signallerDC:null,nextAction:WS_ACTION_WRCONN_NEXT};
	if(opts.isWSReq){
		cfg = wrConfig.clients.find(cl=>cl.ip==msgObj.data.fromIP)
						.connObjs.find(co=>co.reqId==msgObj.data.reqId);				
	}
	else{
		cfg = wrConfig.clients.find(cl=>cl.ip==msgObj.data.fromIP)
						.connObjs.find(co=>co.reqId==msgObj.data.reqId);				
		options.signaller=signallerWRDC;
		options.signallerDC=opts.signallerDC;
		options.nextAction=WR_ACTION_WRCONN_NEXT;
		console.log("TBD: processWRConnNext>non-WS router",msgObj,opts,options);
		
	}
	switch(msgObj.data.step){
		case WR_SDP_ANSWER:
			completeConnection(cfg,options);
			break;
		case WR_ICE_EXCHG:
			setICECandidates(cfg.pc,msgObj.data.ice);
			break;
		default:
			console.log("TBD: processWRConnNext>pending",msgObj.data.step,msgObj.data);
		
	}
}

