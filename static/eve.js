let wsConfig={	wsAddress:getUrlIP(),
				wsClientType:WS_CLIENT_IS_EVE, requesterID: uuidv4(),
				greet:true,greeting:{action:WS_ACTION_SET_CLIENT_TYPE,data:{type:WS_CLIENT_IS_EVE}}};
let wrConfig={connObjs:[],localIP:""};	//simpler, just  connections to alice


function processClientSet(msgData){
	wrConfig.localIP=msgData.ip;//save local IP
	console.log("INFO: processClientSet>sending WR init request",msgData);	
	wsSend({action:WS_ACTION_WRCONN_INIT,data:{fromIP:wrConfig.localIP,reqId:wsConfig.requesterID}});
}

function processWRInitRequest(msgObj){
	updateDOM(WS_STATUS,{evt:WS_STATUS_ERR,evtData:"Unexpected WR Init Request from: "+msgObj.data.fromIP});
	console.log("ERR: processWRInitRequest>",msgObj);
}

function processVid(vidData){
	switch(vidData.evt){
		case VID_STATUS_STREAM_REMOTE: //remote
			console.log("DBG: attempting video",vidData);
			let ev = vidData.evtData.rtcTrkEvt
			let inboundStream = vidData.evtData.ibs;
			let videoElem = document.getElementById("client0_received_video");
			
			if (ev.streams && ev.streams[0]) {
				videoElem.srcObject = ev.streams[0];
			}
			else {
				videoElem.srcObject = inboundStream;
				inboundStream.addTrack(ev.track);
			}
			break;
		default:
			console.log("TBD: processVid",vidData.evt);
	}
	
}

function getDCSuffix(chName){
	//with 
	let suffix=WR_DC_CH_NOT_FOUND;
	for(let coIdx=0;coIdx<wrConfig.connObjs.length;coIdx++){
		for(let chIdx=0;chIdx<wrConfig.connObjs[coIdx].channels.length;chIdx++){
				//console.log("DBG: getDCSuffix>itr>",coIdx,chIdx,wrConfig.connObjs[coIdx].channels[chIdx].chName.length,chName.length,wrConfig.connObjs[coIdx].channels[chIdx].chName==chName);
				if(wrConfig.connObjs[coIdx].channels[chIdx].chName==chName){
					//suffix= "client"+coIdx+"_dc"+chIdx;
					//coIdx=wrConfig.connObjs.length; //break out
					return "client"+coIdx+"_dc"+chIdx;
					break;
				}
		}		
	}
	console.log("DBG: getDCSuffix>for chName:",chName, " suffix:",WR_DC_CH_NOT_FOUND);
	return suffix;
}

function processWRConnNext(msgObj,opts){
	console.log("DBG: processWRConnNext>",msgObj);
	switch(msgObj.data.step){
		case WR_SDP_OFFER: //if you get SDP offer, process and create response
			//create new blank connConfig object
			let connCfg={
							 pc:null,reqId:msgObj.data.reqId,
							 ice:{
									newICE:[],exchangedICE:[],exchange:false
								 },
							 channels:[],ip:WS_CLIENT_IS_ALICE,client:"client0_"
						};
			let options = { nextAction:opts.isWSReq?WS_ACTION_WRCONN_NEXT:WR_ACTION_WRCONN_NEXT,
							signaller:opts.isWSReq?signallerWS:signallerWRDC,
							signallerDC:isUndef(opts.signallerDC)?"":opts.signallerDC,
							sdp:msgObj.data.sdp,
							createDC:opts.isWSReq?true:true,
							addVideo:isUndef(opts.addVideo)?false:opts.addVideo,
							hndVidCfg:null}
			wrConfig.connObjs.push(connCfg);
			buildConnection(connCfg,options);
			break;
		case WR_ICE_EXCHG:
			let cfg = wrConfig.connObjs.find(co=>co.reqId==msgObj.data.reqId);
			setICECandidates(cfg.pc,msgObj.data.ice);
			break;
		default:
			console.log("TBD: processWRConnNext>pending",msgObj.data.step,msgObj.data);
		
	}
}

function retryConnection(msg){
	if(msg.data.error==ERR_ALICE_UNAVAILABLE){//alice may take time coming online
		console.log("DBG: retryConnection>retrying... in 5");
		window.setTimeout(function(){//try reconnecting after 5 seconds
			updateDOM(WS_STATUS,{evt:WS_STATUS_RETRY,evtData:"Retrying Alice for WR"});					
			wsSend({action:WS_ACTION_WRCONN_INIT,data:{fromIP:"",reqId:wsConfig.requesterID	}});
		}, 5000);
	}
}

function getUrlIP(){
	let wsIP = "ws://"+ window.location.hostname+(":1337");
	return wsIP;
}

function setWSIP(){
	
	websocketInit(wsConfig);
	document.getElementById("setIP").disabled=true;
	document.addEventListener('DOMUpdate',requestVideo);
}

function getDCHnd(chName){
	let dcCh=WR_DC_CH_NOT_FOUND;
		wrConfig.connObjs.forEach(co=>{
			co.channels.forEach(ch=>{
				if(ch.chName==chName){ dcCh=ch.chHnd; return;}
			});
		});
	return dcCh;
}
function requestVideo(evt){
	if(evt.detail.name==WR_STATUS&&evt.detail.details.evt==WR_STATUS_DC_OPEN){
		console.log("DBG: requestVideo>on ",WR_STATUS_DC_OPEN,evt.detail.details.evt);
		let dcCh=WR_DC_CH_NOT_FOUND;
		wrConfig.connObjs.forEach(co=>{
			co.channels.forEach(ch=>{
				if(ch.chName==evt.detail.details.srcCh&&ch.dir=="OUT"){ dcCh=ch.chHnd; return;}
			});
		});
		if(dcCh!=WR_DC_CH_NOT_FOUND){
			console.log("INFO: requestVideo","found DC evt",evt.detail.details);
			let vidMsg={wrAction:WR_ACTION_REQ_VIDEO,
					wrStep:WR_REQ_VIDCH,
					target:WS_CLIENT_IS_ALICE,
					reqId:uuidv4(),
					msg:"Meh?"
				   }
			signallerWRDC(vidMsg,dcCh);
			document.removeEventListener('DOMUpdate',requestVideo);
		}
		
	}
}