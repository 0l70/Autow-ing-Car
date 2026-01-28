import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { useStompClient } from '@/shared/realtime/clients/useStompClient'; // Existing Stomp Client
import { z } from 'zod';

// --- Configuration ---
// STUN/TURN Servers (from EC2 Setup)
const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        {
            urls: "turn:i14a402.p.ssafy.io:8000", // EC2 TURN Address through Custom Port
            username: "myuser",
            credential: "mypassword"
        },
        { urls: "stun:stun.l.google.com:19302" } // Google Public STUN (Backup)
    ]
};

// Signaling Message Schema
// Basic Signaling Message Schema with defaults to avoid undefined issues
const SignalingSchema = z.object({
    type: z.enum(['OFFER', 'ANSWER', 'ICE']),
    sdp: z.string().optional(),
    candidate: z.string().optional(),
    sdpMid: z.string().optional(),
    sdpMLineIndex: z.number().optional().nullable(), // Allow null explicitly
    senderId: z.string(),
    receiverId: z.string()
});

type SignalingMessage = z.infer<typeof SignalingSchema>;

interface UseWebRTCProps {
    enabled: boolean;
    carId: string;
    pilotId: string;
}

export function useWebRTC({ enabled, carId, pilotId }: UseWebRTCProps) {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const { socketToken } = useAuthStore();
    
    // --- 1. Connect & Subscribe ---
    const handleConnect = useCallback((sendFn: (cmd: string, headers: Record<string, string>, body?: string) => void) => {
        console.log("WebRTC Signaling Connected. Subscribing...");
        
        // Subscribe to Offer
        sendFn("SUBSCRIBE", { 
            id: "sub-video-offer", 
            destination: `/topic/video/offer/${pilotId}` 
        });

        // Subscribe to ICE
        sendFn("SUBSCRIBE", { 
            id: "sub-video-ice", 
            destination: `/topic/video/ice/${pilotId}` 
        });
    }, [pilotId]);


    // Use Shared Stomp Client
    const { onMessage, send } = useStompClient({ 
        url: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket',
        token: socketToken,
        enabled: enabled,
        onConnect: handleConnect 
    });

    // --- 2. WebRTC Initialization ---
    const createPeerConnection = useCallback(() => {
        if (pcRef.current) return pcRef.current;

        const pc = new RTCPeerConnection(RTC_CONFIG);
        
        pc.ontrack = (event) => {
            const remoteStream = event.streams[0];
            if (remoteStream) {
                console.log('[WebRTC] Stream received:', remoteStream.id);
                setStream(remoteStream);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection State:', pc.connectionState);
            setConnectionState(pc.connectionState);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Correct send usage: Command, Headers, Body
                send('SEND', { destination: '/app/video/ice' }, JSON.stringify({
                    type: 'ICE',
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    senderId: pilotId,
                    receiverId: carId
                }));
            }
        };

        pc.addTransceiver('video', { direction: 'recvonly' });

        pcRef.current = pc;
        return pc;
    }, [carId, pilotId, send]);

    // --- 3. Signaling Handlers ---
    const handleOffer = useCallback(async (msg: SignalingMessage) => {
        if (!pcRef.current) createPeerConnection();
        const pc = pcRef.current!;

        if (pc.signalingState !== 'stable') {
            console.warn('[WebRTC] Signaling state not stable, ignoring Offer');
            return;
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription({
                type: 'offer',
                sdp: msg.sdp || ""
            }));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Correct send usage
            send('SEND', { destination: '/app/video/answer' }, JSON.stringify({
                type: 'ANSWER',
                sdp: answer.sdp,
                senderId: pilotId,
                receiverId: carId
            }));
            
            console.log('[WebRTC] Sent ANSWER');
        } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
        }
    }, [createPeerConnection, carId, pilotId, send]);

    const handleIce = useCallback(async (msg: SignalingMessage) => {
        if (!pcRef.current) return;
        const pc = pcRef.current;

        try {
            if (msg.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate({
                    candidate: msg.candidate || "",
                    sdpMid: msg.sdpMid ?? null,
                    sdpMLineIndex: msg.sdpMLineIndex ?? null
                }));
            }
        } catch (err) {
            console.error('[WebRTC] Error adding ICE:', err);
        }
    }, []);

    // --- 4. Message Listener ---
    useEffect(() => {
        if (!enabled) {
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
                setStream(null);
                setConnectionState('closed');
            }
            return;
        }

        // Initialize PC immediately
        createPeerConnection();

        // Register Global Message Listener and Filter by Type
        const unsubscribe = onMessage((payload) => {
            const result = SignalingSchema.safeParse(payload);
            if (!result.success) return; // Not a signaling message

            const msg = result.data;
            // Filter logic: Check if message is intended for me?
            // (Backend already filters by topic, but double check doesn't hurt)
            
            if (msg.type === 'OFFER') {
                handleOffer(msg);
            } else if (msg.type === 'ICE') {
                handleIce(msg);
            }
        });

        // Request Stream (Optional trigger)
        // send('SEND', { destination: '/app/start-stream' }, JSON.stringify({ targetId: carId }));

        return () => {
            unsubscribe();
        };

    }, [enabled, onMessage, createPeerConnection, handleOffer, handleIce, send, carId]);

    return {
        stream,
        connectionState
    };
}
