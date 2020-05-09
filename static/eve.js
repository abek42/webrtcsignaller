let wsConfig={	wsAddress:getUrlIP(),
				wsClientType:WS_CLIENT_IS_EVE, requesterID: uuidv4(),
				greet:true,greeting:{action:WS_ACTION_SET_CLIENT_TYPE,data:{type:WS_CLIENT_IS_EVE}}};
let wrConfig={connObjs:[]};	//simpler, just  connections to alice


function processClientSet(){
	console.log("INFO: processClientSet>",);	
	wsSend({action:WS_ACTION_WRCONN_INIT,data:{fromIP:"",reqId:wsConfig.requesterID	}});
}

function processWRInitRequest(msgObj){
	updateDOM(WS_STATUS,{evt:WS_STATUS_ERR,evtData:"Unexpected WR Init Request from: "+msgObj.data.fromIP});
	console.log("ERR: processWRInitRequest>",msgObj);
}

function processWRConnNext(msgObj){
	switch(msgObj.data.step){
		case WR_SDP_OFFER: //if you get SDP offer, process and create response
			let connCfg={
							 pc:null,reqId:msgObj.data.reqId,
							 ice:{
									newICE:[],exchangedICE:[],exchange:false
								 },
							 channels:[],ip:WS_CLIENT_IS_ALICE,client:"client0_",
							 hndVidCfg:null,addVideo:false,createDC:true
						};
			wrConfig.connObjs.push(connCfg);
			buildConnection(connCfg,signallerWS,msgObj.data.sdp);
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
}