import { useRef, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useParams } from "react-router-dom";

const Room: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const userVideo = useRef<HTMLVideoElement>(null!);
    const otherUserVideo = useRef<HTMLVideoElement>(null!);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const userStream = useRef<MediaStream | null>(null);
    const otherUser = useRef<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");

    useEffect(() => {
        const initMediaStream = async () => {
            try {
                console.log("Initializing media stream");
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                userVideo.current.srcObject = stream;
                userStream.current = stream;

                socketRef.current = io("/"); // Ensure backend is proxied correctly
                socketRef.current.emit("join-room", roomId);

                socketRef.current.on("other-user", (userId: string) => {
                    console.log("Other user detected:", userId);
                    otherUser.current = userId;
                    callUser(userId);
                });

                socketRef.current.on("user-joined", (userId: string) => {
                    console.log("User joined:", userId);
                    otherUser.current = userId;
                });

                socketRef.current.on("offer", handleReceivedCall);
                socketRef.current.on("answer", handleAnswer);
                socketRef.current.on("ice-candidate", handleNewIceCandidate);

            } catch (err) {
                console.error("Error accessing media devices:", err);
            }
        };

        initMediaStream();

        return () => {
            userStream.current?.getTracks().forEach(track => track.stop());
            peerRef.current?.close();
            socketRef.current?.disconnect();
        };
    }, [roomId]);

    const callUser = (userId: string) => {
        if (!userStream.current) {
            console.error("User media stream not ready.");
            return;
        }

        peerRef.current = createPeer(userId);
        userStream.current.getTracks().forEach((track) => {
            peerRef.current?.addTrack(track, userStream.current!);
        });
    };

    const createPeer = (userId: string) => {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" },
                { urls: "stun:stun3.l.google.com:19302" },
                { urls: "stun:stun4.l.google.com:19302" },
            ],
        });

        peer.onicecandidate = handleIceCandidateEvent;
        peer.ontrack = handleTrackEvent;
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userId);

        peer.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", peer.iceConnectionState);
            setConnectionStatus(peer.iceConnectionState);
        };

        peer.onconnectionstatechange = () => {
            console.log("Connection State:", peer.connectionState);
            setConnectionStatus(peer.connectionState);
        };

        return peer;
    };

    const handleNegotiationNeededEvent = (userId: string) => {
        peerRef.current
            ?.createOffer()
            .then((offer) => peerRef.current?.setLocalDescription(offer))
            .then(() => {
                const payload = {
                    target: userId,
                    caller: socketRef.current?.id,
                    sdp: peerRef.current?.localDescription,
                };
                socketRef.current?.emit("offer", payload);
            })
            .catch((err) => console.error("Error during negotiation:", err));
    };

    const handleReceivedCall = (incoming: { sdp: RTCSessionDescriptionInit; caller: string }) => {
        otherUser.current = incoming.caller;

        peerRef.current = createPeer(incoming.caller);
        const desc = new RTCSessionDescription(incoming.sdp);

        peerRef.current
            ?.setRemoteDescription(desc)
            .then(() => {
                if (userStream.current) {
                    userStream.current.getTracks().forEach((track) => {
                        peerRef.current?.addTrack(track, userStream.current!);
                    });
                }
            })
            .then(() => peerRef.current?.createAnswer())
            .then((answer) => peerRef.current?.setLocalDescription(answer))
            .then(() => {
                const payload = {
                    target: incoming.caller,
                    caller: socketRef.current?.id,
                    sdp: peerRef.current?.localDescription,
                };
                socketRef.current?.emit("answer", payload);
            })
            .catch((err) => console.error("Error handling received call:", err));
    };

    const handleAnswer = (message: { sdp: RTCSessionDescriptionInit; caller: string }) => {
        console.log("Handling answer from:", message.caller);
        const desc = new RTCSessionDescription(message.sdp);
        peerRef.current
            ?.setRemoteDescription(desc)
            .catch((err) => console.error("Error setting remote description in handleAnswer:", err));
    };

    const handleIceCandidateEvent = (e: RTCPeerConnectionIceEvent) => {
        if (e.candidate) {
            console.log("Sending ICE candidate");
            const payload = {
                target: otherUser.current,
                candidate: e.candidate,
            };
            socketRef.current?.emit("ice-candidate", payload);
        }
    };

    const handleNewIceCandidate = (incoming: { candidate: RTCIceCandidateInit }) => {
        console.log("Received ICE candidate");
        const candidate = new RTCIceCandidate(incoming.candidate);
        peerRef.current
            ?.addIceCandidate(candidate)
            .catch((err) => console.error("Error adding received ICE candidate:", err));
    };

    const handleTrackEvent = (e: RTCTrackEvent) => {
        console.log("Track event received:", e);
        if (otherUserVideo.current) {
            otherUserVideo.current.srcObject = e.streams[0];
        }
    };

    return (
        <div>
            <h2>Your Video</h2>
            <video autoPlay playsInline muted ref={userVideo} style={{ width: "45%", marginRight: "10%" }} />
            <h2>Other User's Video</h2>
            <video autoPlay playsInline ref={otherUserVideo} style={{ width: "45%" }} />
            <p>Connection Status: {connectionStatus}</p>
        </div>
    );
};

export default Room;