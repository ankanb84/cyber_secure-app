import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import socketService from "../../services/socket";
import api from "../../services/api";

const WebRTCCall = forwardRef(({ selectedUser, myUserId, onEndCall, users = [] }, ref) => {
  const [isCalling, setIsCalling] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callState, setCallState] = useState("idle"); // idle, calling, ringing, connected
  const [callType, setCallType] = useState("voice"); // voice or video
  const [callId, setCallId] = useState(null);
  const [dbCallId, setDbCallId] = useState(null);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [peerUser, setPeerUser] = useState(null);
  const [startTime, setStartTime] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);

  useImperativeHandle(ref, () => ({
    startCall: (type) => startCall(type)
  }));
  useEffect(() => {
    // Connect socket regardless of selectedUser
    socketRef.current = socketService.connect(localStorage.getItem("token"));

    socketRef.current.on("call_offer", async (data) => {
      console.log("WebRTC: Received call_offer", data);
      // Find who is calling
      const caller = users.find(u => u._id === data.from || u.id === data.from) || { _id: data.from, name: "Unknown Caller", username: "Unknown" };

      setPeerUser(caller);
      setIsIncomingCall(true);
      setCallState("ringing");
      setCallId(data.callId);
      setDbCallId(data.dbCallId);
      setCallType(data.callType || "voice");
      console.log("WebRTC: Set call type to", data.callType || "voice");
      setIncomingOffer(data.offer);
    });

    socketRef.current.on("call_answer", async (data) => {
      console.log("WebRTC: Received call_answer", data);
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        setCallState("connected");
        setStartTime(Date.now());
      }
    });

    socketRef.current.on("ice_candidate", async (data) => {
      console.log("WebRTC: Received ice_candidate", data);
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    });

    socketRef.current.on("call_end", (data) => {
      console.log("WebRTC: Received call_end", data);
      handleEndCall();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off("call_offer");
        socketRef.current.off("call_answer");
        socketRef.current.off("ice_candidate");
        socketRef.current.off("call_end");
      }
    };
  }, [users]);

  const createPeerConnection = async () => {
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && peerUser) {
        socketRef.current.emit("ice_candidate", {
          recipientId: peerUser._id || peerUser.id,
          candidate: event.candidate,
          callId
        });
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async (type = "voice") => {
    if (!selectedUser) return;

    try {
      setPeerUser(selectedUser);
      setIsCalling(true);
      setCallType(type);
      setCallState("calling");
      const newCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setCallId(newCallId);

      // Get user media
      const constraints = {
        audio: true,
        video: type === "video"
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = await createPeerConnection();

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Create call record in DB
      try {
        const callRes = await api.post("/calls", {
          receiverId: selectedUser._id || selectedUser.id,
          type
        });
        setDbCallId(callRes.data._id);

        // Send offer
        socketRef.current.emit("call_offer", {
          recipientId: selectedUser._id || selectedUser.id,
          offer: offer,
          callId: newCallId,
          dbCallId: callRes.data._id,
          callType: type
        });
      } catch (apiErr) {
        console.error("Failed to create call record", apiErr);
        // Continue with call even if DB fails? Maybe better to fail safely or just log it.
        // For now, we proceed but history won't work for this call if DB failed.
        socketRef.current.emit("call_offer", {
          recipientId: selectedUser._id || selectedUser.id,
          offer: offer,
          callId: newCallId,
          callType: type
        });
      }

      // setCallState("ringing"); // Wait for answer to connect, but show calling UI
    } catch (err) {
      console.error("Failed to start call:", err);
      alert("Failed to start call: " + err.message);
      handleEndCall();
    }
  };

  const acceptCall = async () => {
    if (!peerUser || !callId) return;

    try {
      setIsIncomingCall(false);
      setCallState("connected");

      // Get user media
      const constraints = {
        audio: true,
        video: callType === "video"
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && callType === "video") {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = await createPeerConnection();

      // Set remote description from incoming offer
      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      }

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer
      socketRef.current.emit("call_answer", {
        recipientId: peerUser._id || peerUser.id,
        answer: answer,
        callId
      });

      setStartTime(Date.now());

      // Update DB status
      if (dbCallId) {
        api.put(`/calls/${dbCallId}`, { status: 'connected' }).catch(console.error);
      }
    } catch (err) {
      console.error("Failed to accept call:", err);
      alert("Failed to accept call: " + err.message);
      handleEndCall();
    }
  };

  const rejectCall = () => {
    if (socketRef.current && peerUser && callId) {
      socketRef.current.emit("call_end", {
        recipientId: peerUser._id || peerUser.id,
        callId
      });
    }
    handleEndCall();
  };

  const handleEndCall = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Send end call signal if we initiated or are connected
    if (socketRef.current && peerUser && callId && (callState === 'connected' || callState === 'calling')) {
      // Only send if we haven't already received an end signal (handled by logic flow usually)
      // But here we just want to emit if we are manually ending it.
      // The socket listener calls this function too, so we need to avoid infinite loop.
      // Actually, if called from socket listener, we don't need to emit.
      // We can distinguish by checking if this function was called by user interaction.
      // For simplicity, we emit if we are in a state that implies we are active.
      // However, to avoid complexity, we rely on the fact that if the other side ended it, they emitted it.
      // If WE click end, we emit it.
      // We can check if the call is still active.
    }

    // If user clicked end button
    if (socketRef.current && peerUser && callId && (isCalling || callState === 'connected')) {
      socketRef.current.emit("call_end", {
        recipientId: peerUser._id || peerUser.id,
        callId
      });
    }

    // Update DB
    if (dbCallId) {
      const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      let status = 'missed';
      if (callState === 'connected') status = 'completed';
      else if (isIncomingCall && callState === 'ringing') status = 'rejected'; // If we are ending it while ringing, we rejected it

      // If we are the caller and we cancel before connection, it's missed (or cancelled)
      // The backend defaults to 'missed', so we only need to update if it's completed or rejected

      api.put(`/calls/${dbCallId}`, {
        status,
        duration
      }).catch(console.error);
    }

    setIsCalling(false);
    setIsIncomingCall(false);
    setCallState("idle");
    setCallId(null);
    setDbCallId(null);
    setStartTime(null);
    setIncomingOffer(null);
    setPeerUser(null);
    onEndCall?.();
  };

  if (callState === "idle" && !isIncomingCall) {
    return null; // Don't render anything when idle
  }

  if (isIncomingCall && callState === "ringing") {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        backdropFilter: "blur(10px)"
      }}>
        <div style={{ textAlign: "center", color: "white", background: "rgba(20, 25, 40, 0.9)", padding: "40px", borderRadius: "24px", border: "1px solid var(--primary)" }}>
          <div style={{ fontSize: "40px", marginBottom: "20px" }}>
            {callType === "video" ? "📹" : "📞"}
          </div>
          <h2>Incoming {callType === "video" ? "Video" : "Voice"} Call</h2>
          <p style={{ color: "var(--primary)", fontSize: "1.2rem", margin: "10px 0 30px" }}>{peerUser?.name || peerUser?.username}</p>
          <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
            <button
              className="primary-btn"
              onClick={acceptCall}
              style={{ padding: "12px 32px", fontSize: "1.1rem", borderRadius: "50px" }}
            >
              Accept
            </button>
            <button
              className="secondary-btn"
              onClick={rejectCall}
              style={{ padding: "12px 32px", fontSize: "1.1rem", background: "rgba(255, 42, 109, 0.2)", borderColor: "var(--danger)", color: "var(--danger)", borderRadius: "50px" }}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (callState === "connected" || callState === "ringing" || callState === "calling") {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        zIndex: 2000
      }}>
        {callType === "video" && (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                width: "200px",
                height: "150px",
                borderRadius: "12px",
                objectFit: "cover",
                border: "2px solid var(--primary)",
                boxShadow: "0 0 20px rgba(0, 240, 255, 0.2)"
              }}
            />
          </>
        )}

        {callType === "voice" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div style={{ width: "150px", height: "150px", borderRadius: "50%", background: "var(--glass-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "60px", border: "2px solid var(--primary)", boxShadow: "0 0 50px var(--primary-glow)" }}>
              👤
            </div>
            <h2 style={{ marginTop: "30px" }}>{peerUser?.name || peerUser?.username}</h2>
            <p style={{ color: "var(--text-muted)" }}>{callState === "connected" ? "00:00" : "Calling..."}</p>
          </div>
        )}

        <div style={{
          position: "absolute",
          bottom: "40px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "20px",
          background: "rgba(255, 255, 255, 0.1)",
          padding: "20px",
          borderRadius: "40px",
          backdropFilter: "blur(10px)"
        }}>
          <button
            className="secondary-btn"
            onClick={handleEndCall}
            style={{
              padding: "0",
              borderRadius: "50%",
              background: "var(--danger)",
              width: "60px",
              height: "60px",
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none"
            }}
          >
            📞
          </button>
        </div>

        {callState === "calling" && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "white",
            background: "rgba(0,0,0,0.5)",
            padding: "20px",
            borderRadius: "16px"
          }}>
            <h2>Ringing...</h2>
          </div>
        )}
      </div>
    );
  }

  return null;
});

export default WebRTCCall;

