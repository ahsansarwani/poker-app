import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const SPEAKING_THRESHOLD = 12; // 0-255 avg volume above which we treat someone as "speaking"

function emptySet() {
  return new Set();
}

function toggleInSet(set, value, shouldHave) {
  const has = set.has(value);
  if (has === shouldHave) return set;
  const next = new Set(set);
  if (shouldHave) next.add(value);
  else next.delete(value);
  return next;
}

// Mesh WebRTC voice chat over the existing socket.io connection as the signaling
// channel. Audio only flows once a player enables their mic, but peer connections
// are opened for everyone at the table so audio starts flowing the moment either
// side turns their mic on (no extra join step, no renegotiation surprises).
export function useVoiceChat(socket, roomId) {
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState("");
  const [remoteAudios, setRemoteAudios] = useState([]); // [{ peerId, stream }]
  const [remoteSpeaking, setRemoteSpeaking] = useState(emptySet);
  const [remoteMuted, setRemoteMuted] = useState(emptySet);
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> { pc, seat, polite, makingOffer, ignoreOffer }
  const analysersRef = useRef(new Map()); // key -> { ctx, raf }

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof RTCPeerConnection !== "undefined";

  const stopSpeakingDetector = useCallback((key) => {
    const entry = analysersRef.current.get(key);
    if (!entry) return;
    cancelAnimationFrame(entry.raf);
    entry.ctx.close().catch(() => {});
    analysersRef.current.delete(key);
  }, []);

  const startSpeakingDetector = useCallback((key, stream, onChange) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let speaking = false;
      const entry = { ctx, raf: 0 };
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const now = avg > SPEAKING_THRESHOLD;
        if (now !== speaking) {
          speaking = now;
          onChange(speaking);
        }
        entry.raf = requestAnimationFrame(tick);
      };
      entry.raf = requestAnimationFrame(tick);
      analysersRef.current.set(key, entry);
    } catch {
      // AnalyserNode unavailable — voice audio still works, just no speaking indicator
    }
  }, []);

  const removePeer = useCallback(
    (peerId) => {
      const entry = peersRef.current.get(peerId);
      if (!entry) return;
      entry.pc.close();
      peersRef.current.delete(peerId);
      stopSpeakingDetector(peerId);
      setRemoteAudios((list) => list.filter((a) => a.peerId !== peerId));
      setRemoteSpeaking((s) => toggleInSet(s, entry.seat, false));
      setRemoteMuted((s) => toggleInSet(s, entry.seat, false));
    },
    [stopSpeakingDetector]
  );

  const ensurePeer = useCallback(
    (peerId, seat) => {
      const existing = peersRef.current.get(peerId);
      if (existing) {
        if (seat !== undefined && seat !== -1) existing.seat = seat;
        return existing;
      }

      const polite = socket.id > peerId; // deterministic: the lower id's offer always wins a collision
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const entry = { pc, seat, polite, makingOffer: false, ignoreOffer: false };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit("voiceSignal", { to: peerId, data: { candidate } });
      };

      pc.onnegotiationneeded = async () => {
        try {
          entry.makingOffer = true;
          await pc.setLocalDescription();
          socket.emit("voiceSignal", { to: peerId, data: { description: pc.localDescription } });
        } catch (err) {
          console.error("voice negotiation failed", err);
        } finally {
          entry.makingOffer = false;
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        setRemoteAudios((list) =>
          list.some((a) => a.peerId === peerId)
            ? list.map((a) => (a.peerId === peerId ? { ...a, stream } : a))
            : [...list, { peerId, stream }]
        );
        startSpeakingDetector(peerId, stream, (speaking) => {
          setRemoteSpeaking((s) => toggleInSet(s, entry.seat, speaking));
        });
      };

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) pc.addTrack(track, localStreamRef.current);
      }

      peersRef.current.set(peerId, entry);
      return entry;
    },
    [socket, startSpeakingDetector]
  );

  const handleSignal = useCallback(
    async ({ from, data }) => {
      const entry = ensurePeer(from, undefined);
      const { pc, polite } = entry;
      try {
        if (data.description) {
          const offerCollision = data.description.type === "offer" && (entry.makingOffer || pc.signalingState !== "stable");
          entry.ignoreOffer = !polite && offerCollision;
          if (entry.ignoreOffer) return;
          await pc.setRemoteDescription(data.description);
          if (data.description.type === "offer") {
            await pc.setLocalDescription();
            socket.emit("voiceSignal", { to: from, data: { description: pc.localDescription } });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!entry.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error("voice signal error", err);
      }
    },
    [ensurePeer, socket]
  );

  useEffect(() => {
    if (!roomId) return undefined;

    const onPeers = ({ peers }) => {
      for (const { peerId, seat } of peers) ensurePeer(peerId, seat);
    };
    const onPeerJoined = ({ peerId, seat }) => ensurePeer(peerId, seat);
    const onPeerLeft = ({ peerId }) => removePeer(peerId);
    const onSignal = (msg) => handleSignal(msg);
    const onMute = ({ peerId, muted }) => {
      const entry = peersRef.current.get(peerId);
      if (!entry) return;
      setRemoteMuted((s) => toggleInSet(s, entry.seat, muted));
    };

    socket.on("voicePeers", onPeers);
    socket.on("voicePeerJoined", onPeerJoined);
    socket.on("voicePeerLeft", onPeerLeft);
    socket.on("voiceSignal", onSignal);
    // After a reconnect every socket id at the table may have changed: rebuild the mesh from scratch.
    const onReconnect = () => {
      for (const peerId of [...peersRef.current.keys()]) removePeer(peerId);
      socket.emit("voiceJoin");
      if (localStreamRef.current) socket.emit("voiceMute", { muted: !localStreamRef.current.getAudioTracks().some((t) => t.enabled) });
    };

    socket.on("voiceMute", onMute);
    socket.on("connect", onReconnect);
    socket.emit("voiceJoin");

    return () => {
      socket.off("voicePeers", onPeers);
      socket.off("voicePeerJoined", onPeerJoined);
      socket.off("voicePeerLeft", onPeerLeft);
      socket.off("voiceSignal", onSignal);
      socket.off("voiceMute", onMute);
      socket.off("connect", onReconnect);
      socket.emit("voiceLeave");
      for (const peerId of [...peersRef.current.keys()]) removePeer(peerId);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      stopSpeakingDetector("local");
      setMicOn(false);
      setMicError("");
      setRemoteAudios([]);
      setRemoteSpeaking(emptySet());
      setRemoteMuted(emptySet());
      setLocalSpeaking(false);
    };
  }, [roomId, socket, ensurePeer, removePeer, handleSignal, stopSpeakingDetector]);

  const toggleMic = useCallback(async () => {
    if (!supported) {
      setMicError("Voice chat isn't supported in this browser.");
      return;
    }
    if (micOn) {
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
      stopSpeakingDetector("local");
      setLocalSpeaking(false);
      setMicOn(false);
      socket.emit("voiceMute", { muted: true });
      return;
    }
    try {
      if (!localStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        for (const entry of peersRef.current.values()) {
          for (const track of stream.getTracks()) entry.pc.addTrack(track, stream);
        }
        startSpeakingDetector("local", stream, setLocalSpeaking);
      } else {
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
        startSpeakingDetector("local", localStreamRef.current, setLocalSpeaking);
      }
      setMicError("");
      setMicOn(true);
      socket.emit("voiceMute", { muted: false });
    } catch (err) {
      setMicError(err.name === "NotAllowedError" ? "Microphone permission denied." : "Couldn't access microphone.");
    }
  }, [micOn, socket, startSpeakingDetector, stopSpeakingDetector, supported]);

  return { supported, micOn, micError, toggleMic, remoteAudios, remoteSpeaking, remoteMuted, localSpeaking };
}
