function createOffer(callerObj) {
	callerObj.callerPC = new RTCPeerConnection(); 						//this actually creates the RTCPeerConnection.
	callerObj.callerDC = createOutboundDC(callerObj.chName, callerObj.callerPC);		 	//we need one basic datachannel for the offer
	collectICECandidates(callerObj.chName, callerObj.callerPC, callerObj); 		//need caller's ICE list
	let callerPC = callerObj.callerPC;
	callerPC.createOffer() 										//returns a promise which resolves into an offer as a RTCSessionDescription
		.then(function(offer) { 								//set the offer's session description as the local description
			console.log("Caller Local SDP Set");
			return callerPC.setLocalDescription(offer);
		})
		.then(function() { 										//now we are ready to send the offer to the callee via the server
			console.log("Sending to relayer");
			sendToServer({
				state: WR_SDP_OFFER,
				name: callerObj.chName,
				target: callerObj.ip, //this is an identifier that uniquely identifes the remote peer
				type: "datachannel",
				sdp: callerPC.localDescription
			});
		})
		.then(function() { 										//set up listeners for any inbound channels that get added
			callerPC.ondatachannel = function(event) {addInboundChannel(event, callerObj.chName);}
		})
		.catch(function(reason) { // An error occurred, so handle the failure to connect
			console.log("ERR:",reason);
		});
} //next activity happens at server end 

function acceptOffer(calleeObj){
	/*
	
			Eve calls setRemoteDescription() with Alice's offer, 
			Eve calls createAnswer(), and the success callback for this is passed a local session description: Eve's answer.
			Eve sets her answer as the local description by calling setLocalDescription().
			Eve stringifies answer 
	*/
	calleeObj.callerSDP = new RTCSessionDescription(calleeObj.sdpOffer);
	calleeObj.calleePC = new RTCPeerConnection();
	let calleePC = calleeObj.calleePC;
	
	calleeObj.calleeDC = createOutboundDC("callee", calleePC);
	collectICECandidates("callee", calleePC, calleeObj);
	
	calleePC.setRemoteDescription(calleeObj.callerSDP)
		.then(function() {
			return calleePC.createAnswer();
		})
		.then(function(answer) {		
			return calleePC.setLocalDescription(answer);
		})
		.then(function() {
			sendToServer({
				state: WR_SDP_ANSWER,
				name: calleeObj.chName,
				target: "alice",
				type: "datachannel",
				sdp: calleePC.localDescription
			});
			calleeObj.exchangeICE=true;
		})
		.then(function() {
			calleePC.ondatachannel = function(event) {addInboundChannel(event, calleeObj.chName);}
		})
		.catch(function(reason) {
			// An error occurred, so handle the failure to connect
			console.log(reason);
		});	
	
}

function finalizeSession(callerObj){
	let calleeSDP = new RTCSessionDescription(callerObj.remoteSDP);
	callerObj.callerPC.setRemoteDescription(calleeSDP)
		.then(function() {
			console.log("Callee SDP processed");
			callerObj.exchangeICE=true;
			exchangeICE(callerObj,callerObj.chName);
		})
		.catch(function(reason) {
			// An error occurred, so handle the failure to connect
			console.log(reason);
		});
}

function createOutboundDC(name, pc) { //we create this as an outbound only channel
	var dc = pc.createDataChannel(name+"-out");
	dc.onmessage = 	function(event) {//since it is outbound, we don't care much about inbound data
						console.log(name + ":received: " + event.data);
					}; //this needs more processing if it is a bidirectional data channel.
	dc.onopen = 	function() {//once it is opened, some other actions needed here
						//one of these is to tell the view to reflect the status
						triggerDOMUpdate(WREVENT,{id:name, innerHTML:name+" "+dc.readyState+" at: "+Date.now()} );
					};
	dc.onclose = 	function() {//once it is closed, some other actions needed here
						//one of these is to tell the view to reflect the status
						triggerDOMUpdate(WREVENT,{id:name,innerHTML:name+" "+dc.readyState+" at: "+Date.now()});
					};
	return dc;
}

function collectICECandidates(name, pc, iceObj) {
	pc.onicecandidate = function(e) {
		iceObj.ice.candidates.push(e.candidate);
		if(iceObj.exchangeICE){
			exchangeICE(iceObj, name);
		}
		//triggerDOMUpdate({id:name + "ICEs",innerHTML:iceObj.candidates.length})
	}
}

function exchangeICE(iceObj,name){//whenever exchanges occurs, you move the exchanged ones to another array
	console.log("TBD: exchangeICE>",iceObj,name,iceObj.ip);
	if(typeof(iceObj.ice.exchanged)==="undefined") iceObj.ice.exchanged=[];
	iceObj.ice.exchanged=iceObj.ice.exchanged.concat(iceObj.ice.candidates.splice(0,iceObj.ice.candidates.length));
	sendToServer({
				state: WR_ICE_EXCHG,
				name: iceObj.chName,
				forIP: iceObj.ip,
				ice: iceObj.ice.exchanged.slice(0,iceObj.ice.exchanged.length)
			});
	
}

function setICECandidates(pc,ice){
	console.log("TBD: setICECandidates",pc,ice);
	for(let i=0;i<ice.length;i++){
		if(ice[i]!=null){
			pc.addIceCandidate(ice[i])
			.catch(function(e) {
				console.log("ICE Candidate add ended with error ", e, e.message);
			});
		}
	}
}

function addInboundChannel(event, chName){
	var inboundChannel = event.channel;
	
	//irrespective of type, all three have placeholders to show status
	inboundChannel.onopen  = function(){
								triggerDOMUpdate(WREVENT,{id:chName,innerHTML:chName+ " open: "+inboundChannel.readyState+" at: "+Date.now()});
							};
	inboundChannel.onclose = function(){
								triggerDOMUpdate(WREVENT,{id:chName,innerHTML:chName+ " closed: "+inboundChannel.readyState+" at: "+Date.now()});
							};
	//basic dc is processed differently
	inboundChannel.onmessage = function(event) {
								triggerDOMUpdate(WREVENT,{id:chName+"-data",innerHTML:event.data});
								};
}


function triggerDOMUpdate(name,details) {//this emits events that can be captured by DOM to update the view
	var event = new CustomEvent("DOMUpdate", {
		detail: {"name":name, "details":details}
	});
	document.dispatchEvent(event);
}