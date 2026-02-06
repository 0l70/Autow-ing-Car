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
    candidate: z.string().nullable().optional(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(), // Allow null explicitly
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
    // Keep track if we already sent START
    const isStartedRef = useRef(false);
    
    const { socketToken } = useAuthStore();

    // --- 1. Connect & Subscribe ---
    const handleConnect = useCallback((sendFn: (cmd: string, headers: Record<string, string>, body?: string) => void) => {
        console.log(`[useWebRTC] Connected! Subscribing for Pilot: ${pilotId}`);
        
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
    }, [pilotId]); // Stabilized: only depends on pilotId

    // Use Shared Stomp Client (Always enabled to keep connection alive)
    const { onMessage, send, isConnected } = useStompClient({ 
        url: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws-server/websocket',
        token: socketToken,
        enabled: true, // Always keep WebSocket alive
        onConnect: handleConnect 
    });

    // Helper to send Control Messages
    const sendControl = useCallback((type: 'START' | 'PAUSE' | 'RESUME') => {
        if (!isConnected) {
            console.warn(`[useWebRTC] Cannot send ${type}: WebSocket not connected`);
            return;
        }
        
        console.log(`[useWebRTC] Sending ${type} Command to CAR: ${carId}`);
        send("SEND", { destination: '/app/video/control' }, JSON.stringify({
            type,
            senderId: pilotId,
            receiverId: carId
        }));
    }, [isConnected, send, pilotId, carId]);

    // Handle Enable/Disable (START/PAUSE/RESUME)
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


    // Handle Enable/Disable (Smart Resume)
    useEffect(() => {
        if (!isConnected) {
            console.log('[useWebRTC] Socket Disconnected - Resetting START flag');
            isStartedRef.current = false;
            setConnectionState('closed'); // Ensure UI reflects closed state
            return;
        }

        if (enabled) {
            if (!isStartedRef.current) {
                // First time -> START
                console.log('[useWebRTC] Triggering Initial START');
                sendControl('START');
                isStartedRef.current = true;
            } else {
                // Subsequent -> CHECK CONNECTION STATE (Smart Resume)
                const pc = pcRef.current;
                // Fix: 'checking' and 'completed' are ICE states, not Connection states.
                // RTCPeerConnectionState = "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed"
                const isAlive = pc && (pc.connectionState === 'connected'); 

                 if (isAlive) {
                    console.log('[useWebRTC] Connection Healthy -> RESUME');
                    sendControl('RESUME');
                } else {
                    console.log('[useWebRTC] Connection Dead/Unstable -> Full Restart');
                    
                    // Cleanup dead connection
                    if (pc) {
                        pc.close();
                        pcRef.current = null;
                        setConnectionState('closed');
                    }
                    
                    // Re-initialize and START
                    createPeerConnection();
                    sendControl('START');
                    isStartedRef.current = true;
                }
            }
        } else {
            // Disabled -> PAUSE (only if we ever started)
            if (isStartedRef.current) {
                console.log('[useWebRTC] Disabling -> Sending PAUSE');
                sendControl('PAUSE');
                // Note: We DO NOT close the PC here, hoping for a quick RESUME later.
            }
        }
    }, [enabled, isConnected, sendControl, createPeerConnection]);

    // (createPeerConnection moved above)

    // Handle Enable/Disable (Always START / PAUSE)
    useEffect(() => {
        if (!isConnected) return;

        if (enabled) {
            // "Always Fresh Start" Strategy
            console.log('[useWebRTC] Enabling -> Sending START (New Session)');
            
            // 1. Reset any existing PC to ensure clean state for new OFFER
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
            // 2. Initialize fresh PC
            createPeerConnection();

            // 3. Send START to trigger Backend to send new OFFER
            sendControl('START');
        } else {
            // Disable -> PAUSE
            console.log('[useWebRTC] Disabling -> Sending PAUSE');
            sendControl('PAUSE');

            // Cleanup PC locally to save resources and ensure next start is fresh
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
                setConnectionState('closed');
            }
        }
    }, [enabled, isConnected, sendControl, createPeerConnection]);

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
        // Always initialize PC on mount to be ready
        createPeerConnection();

        const unsubscribe = onMessage((msg: any) => {
            const { destination, body: payload } = msg;

            if (!destination?.startsWith('/topic/video/')) return;
            if (!destination?.endsWith(`/${pilotId}`)) return;

            const result = SignalingSchema.safeParse(payload);
            if (!result.success) return;

            const data = result.data;
            if (data.type === 'OFFER') handleOffer(data);
            else if (data.type === 'ICE') handleIce(data);
        });

        return () => {
            // Unmount cleanup
            unsubscribe();
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
        };
    }, [onMessage, createPeerConnection, handleOffer, handleIce, pilotId]);

    return {
        stream,
        connectionState
    };
}
