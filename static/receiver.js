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

/*function processRequest(req){
	 //{request:{action:INIT_CONNECTION, fromIP:null, reqId:<hash>}}
	let action=getAction(req.action);
	if(typeof(req.fromIP)==="undefined"||!isValidIP(req.fromIP)){
		wsSend({response:{"status":OFFER_REJECTED,reason:IP_NOT_ON_WHITELIST, forIP:"undefined", reqId:req.reqId}};
		return;
	}
	
	switch(action){
		case ACTION_INIT_CONNECTION:
			buildConnection(req);
			break;
		default:
			console.log("TBD: processRequest",action);
		
	}
	
}*/

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

function buildConnection(req){
	let obj = {fromIP:req.fromIP,chName:"dc-"+req.fromIP+"-"+req.reqId, callerPC:null, callerDC:null, ice:{candidates: [],exchanged:[]}};
	let client=clients.filter(c=>c.ip==req.fromIP);
	if(client.length==0){
		client.push({ip:req.fromIP,connObjs:[obj]});
	}
	else{
		client.connObjs.push([obj]);
	}
	createOffer(obj);
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