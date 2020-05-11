const WR_STATUS="wr status";
const WR_STATUS_PC="wr pconn created";
const WR_STATUS_WR_INIT="request to setup wr";
const WR_STATUS_ICE_FOUND="wr ice found";
const WR_STATUS_ICE_EXCHG="wr ice sent";
const WR_STATUS_SDP_LOCAL="wr set local SDP";
const WR_STATUS_SDP_REMOTE="wr set sdp remote";
const WR_STATUS_DC_OPEN="wr data ch open";
const WR_STATUS_DC_CLOSED="wr data ch closed";
const WR_STATUS_DC_MSG="wr data ch received msg";

const WR_CH_DATA="wr data channel";

const WR_SDP_ANSWER="wr peer conn sdp answer";
const WR_SDP_OFFER ="wr peer conn sdp offer";
const WR_ICE_EXCHG ="wr peer conn exchange ice";
const WR_REQ_VIDCH ="wr peer requests video";
const WR_DC_TEST_MSG="wr dc test msg";

function buildConnection(config, options){//options structure is {signaller:<fn>,signallerDC:<dc if signallerwrdc>,sdp:<false|sdp>,addVideo:<true|false>,createDC:<true|false>,hndVidCfg:<handle to videoCfg obj>}
	//config structure {pc:peerConn,reqId:<uuid>,ice:{newICE:[],exchangedICE:[],exchange:false},channels:[],ip:ip,client:"client<#>_",hndVidCfg:<>};
	updateDOM(WR_STATUS,{evt:WR_STATUS_WR_INIT,evtData:config.client});
	
	let peerConn = new RTCPeerConnection();
	updateDOM(WR_STATUS,{evt:WR_STATUS_PC,evtData:config.client});
	
	if(options.createDC){//normally, this is essential for PeerConn to complete all init steps
		createDC(config,peerConn);
	}
	
	//ice exchange is default, so set it up
	peerConn.onicecandidate = function(e) {
		//console.log("DBG: buildConnection>event onICE",e);
		config.ice.newICE.push(e.candidate);
		updateDOM(WR_STATUS,{evt:WR_STATUS_ICE_FOUND,evtData:config.client});
		if(config.ice.exchange){
			exchangeICE(config.ice, config, {signaller:options.signaller,signallerDC:options.signallerDC,nextAction:options.nextAction});
		}
	}
	
	peerConn.ontrack = function(e){
		console.log("TBD: buildConnection>onTrack>",config,e);
		if(!config.inboundStream){	config.inboundStream=new MediaStream();}
		updateDOM(VID_STATUS,{evt:VID_STATUS_STREAM_REMOTE,evtData:{rtcTrkEvt:e,ibs:config.inboundStream}});
	}
	
	//check if video tracks are available to add
	let pNext;
	if(options.addVideo&&options.hndVidCfg){//we have the handle to the video obj and we want to add it
		let vcfg=options.hndVidCfg;
		if(vcfg.isReady){//in this case the local stream is ready
			pNext = new Promise((resolve,reject)=>{resolve("ready already")});
		}
		else{//in this case, we need a promise that will be held off.
			pNext = new Promise((resolve,reject)=>{
						navigator.mediaDevices.getUserMedia(vcfg.mediaConstraints)
							.then(function(localStream) {
								updateDOM(VID_STATUS,{evt:VID_STATUS_STREAM,evtData:localStream});
								vcfg.localStream=localStream;
								vcfg.isReady=true;
								for (const track of localStream.getTracks()) {
									peerConn.addTrack(track);
								}//add tracks from localStream to peerConn
								resolve("done");
							});
						});
		}		
	}
	else{//this approach is an attempt to allow two branching paths, one with async wait and another without to merge back into one common flow
		pNext = new Promise((resolve,reject)=>{resolve("ready already")});
	}
	
	if(!options.sdp){//we weren't given an sdp
		pNext.then(()=>{
			peerConn.createOffer()	//returns a promise which resolves into an offer as a RTCSessionDescription
			.then(function(offer){
				updateDOM(WR_STATUS,{evt:WR_STATUS_SDP_LOCAL,evtData:config.client});
				return peerConn.setLocalDescription(offer);
			})
			.then(function() {
				console.log("INFO: completeConnection>set inboundChannel listener");
				peerConn.ondatachannel = function(event) {addInboundChannel(event,config);}
			})
			.then(function(){
				console.log("DBG: buildConnection>!sdp branch>sending out offer");
				options.signaller(
					{
						wrAction:options.nextAction,
						wrStep:WR_SDP_OFFER,
						target:config.ip,
						sdp:peerConn.localDescription,
						reqId:config.reqId,
					},options.signallerDC
				);
				config.pc=peerConn;//save reference to it
			})
			.catch(function(e){
				console.log("ERR: buildConnection>!sdp branch>",e);
			});
		});		
	}
	else{//sdp was provided, so this is the other end of the connection
		let remoteSDP = new RTCSessionDescription(options.sdp);
		
		pNext.then(()=>{
			peerConn.setRemoteDescription(remoteSDP)
			.then(function() {
				updateDOM(WR_STATUS,{evt:WR_STATUS_SDP_REMOTE,evtData:config.client});
				return peerConn.createAnswer();
			})
			.then(function(answer) {
				updateDOM(WR_STATUS,{evt:WR_STATUS_SDP_LOCAL,evtData:config.client});
				return peerConn.setLocalDescription(answer);
			})
			.then(function() {
				//console.log("DBG: buildConnection>remote SDP path>sending out response")
				options.signaller(
					{
						wrAction:options.nextAction,
						wrStep:WR_SDP_ANSWER,
						target: config.ip,
						sdp: peerConn.localDescription,
						reqId:config.reqId
					},options.signallerDC
				);
				config.pc=peerConn;
				config.ice.exchange=true;
				exchangeICE(config.ice, config, {signaller:options.signaller,signallerDC:options.signallerDC,nextAction:options.nextAction});
			})
			.then(function() {
				console.log("INFO: buildConnection>set inboundChannel listener");
				peerConn.ondatachannel = function(event) {addInboundChannel(event,config);}
			})
			.catch(function(reason) {
				// An error occurred, so handle the failure to connect
				console.log("ERR: buildConnection>remote sdp branch>",reason);
			});	
		});	
	}
}

function completeConnection(config, options){
	let remoteSDP = new RTCSessionDescription(options.sdp);
	config.pc.setRemoteDescription(remoteSDP)
		.then(function() {
			updateDOM(WR_STATUS,{evt:WR_STATUS_SDP_REMOTE,evtData:config.client});
			config.ice.exchange=true;
			exchangeICE(config.ice, config, {signaller:options.signaller,signallerDC:options.signallerDC,nextAction:options.nextAction});
		})
		.catch(function(reason) {
			// An error occurred, so handle the failure to connect
			console.log("ERR: completeConnection>failed>",reason);
		});
}

function createDC(config,pc) { //we create this as an outbound only channel
	let dcName = config.reqId+"-dc-to-"+config.client;
	let dc = pc.createDataChannel(dcName);
	config.channels.push({"chHnd":dc,chName:dcName,chType:WR_CH_DATA,dir:"OUT"});
	dc.onmessage = 	function(event) {//blink UI and then ask notifyData to send it over as a DataEvents
						console.log("INFO: createDC> on msg>ch:",dcName,"len: ",event.data.length);
						updateDOM(WR_STATUS,{evt:WR_STATUS_DC_MSG,evtData:config.client,srcCh:dcName,msgLen:event.data.length});
						notifyData({action:WR_ACTION_DC_MSG,data:{msgData:event.data,evtData:config.client,srcCh:dcName,chHnd:dc}});
					}; //this needs more processing if it is a bidirectional data channel.
	dc.onopen = 	function() {//once it is opened, some other actions needed here
						//one of these is to tell the view to reflect the status
						console.log("DBG: createDC>onopen>send test msg using",dcName);
						updateDOM(WR_STATUS,{evt:WR_STATUS_DC_OPEN,evtData:config.client,srcCh:dcName});
						dc.send(WR_DC_TEST_MSG);
					};
	dc.onclose = 	function() {//once it is closed, some other actions needed here
						//one of these is to tell the view to reflect the status
						updateDOM(WR_STATUS,{evt:WR_STATUS_DC_CLOSED,evtData:config.client,srcCh:dcName});
					};
	dc.onerror =function(event){
					console.log("DC ERR: ",event);
				}
}


function exchangeICE(iceObj,cfg,signalOpts){//whenever exchanges occurs, you move the exchanged ones to another array
	if(typeof(iceObj.exchangedICE)==="undefined") iceObj.exchangedICE=[];
	if(iceObj.newICE.length>1||iceObj.newICE[0]!=null){//for some reason FF adds a null ICE, we don't want to exchange just that one
		updateDOM(WR_STATUS,{evt:WR_STATUS_ICE_EXCHG,evtData:cfg.client});
		let toSend = iceObj.newICE.slice(0,iceObj.newICE.length);
		iceObj.exchangedICE = iceObj.exchangedICE.concat(iceObj.newICE.splice(0,iceObj.newICE.length));
		signalOpts.signaller(
					{
						wrAction:signalOpts.nextAction,
						wrStep:WR_ICE_EXCHG,
						target: cfg.ip,
						ice:toSend,
						reqId:cfg.reqId
					},signalOpts.signallerDC
				);
	}
}

function setICECandidates(pc,ice){
	//console.log("TBD: setICECandidates",pc,ice);
	for(let i=0;i<ice.length;i++){
		if(ice[i]!=null){
			pc.addIceCandidate(ice[i])
			.catch(function(e) {
				console.log("ERR: setICECandidates> ICE Candidate add ended with error ", e, e.message);
			});
		}
	}
}


function addInboundChannel(event, cfg){
	let inboundChannel = event.channel;
	let chNameLocal = cfg.reqId+"-from-"+cfg.ip+"_";
	//index if needed
	chNameLocal+=cfg.channels.findIndex(ch=>ch.chName==chNameLocal)+1;
	
	console.log("INFO: adding inbound DC",event.channel.label," as ",chNameLocal);
	cfg.channels.push({"chHnd":inboundChannel,chName:chNameLocal,chType:WR_CH_DATA,dir:"IN"});
	//irrespective of type, all three have placeholders to show status
	inboundChannel.onopen  = function(){
								
								console.log("INFO: inbound DC>onopen>",chNameLocal);
								updateDOM(WR_STATUS,{evt:WR_STATUS_DC_OPEN,evtData:cfg.client,srcCh:chNameLocal});
							};
	inboundChannel.onclose = function(){
								updateDOM(WR_STATUS,{evt:WR_STATUS_DC_CLOSED,evtData:cfg.client,srcCh:chNameLocal});
							};
	//basic dc is processed differently
	inboundChannel.onmessage = function(event) {
								console.log("INFO: inbound DC>onmsg>",chNameLocal,"len: ",event.data.length);
								updateDOM(WR_STATUS,{evt:WR_STATUS_DC_MSG,evtData:cfg.client,srcCh:chNameLocal,msgLen:event.data.length});
								notifyData({action:WR_ACTION_DC_MSG,data:{msgData:event.data,evtData:cfg.client,srcCh:chNameLocal,chHnd:inboundChannel}})
								};
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