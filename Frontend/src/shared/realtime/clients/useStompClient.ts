import { useEffect, useRef, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface StompClientOptions {
    url: string;
    token?: string | null;
    enabled?: boolean; // Default true
    onConnect?: (send: (cmd: string, headers: Record<string, string>, body?: string) => void) => void;
}

export interface StompResponse {
    correlationId?: string;
    status?: 'SUCCESS' | 'FAIL' | 'ACCEPTED' | 'REJECTED';
    message?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export function useStompClient({ url, token, enabled = true, onConnect }: StompClientOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Dispatcher: Map<CorrelationId, PromiseResolvers>
    const pendingRequests = useRef<Map<string, { resolve: (val: StompResponse) => void, reject: (err: Error) => void }>>(new Map());
    
    // Global Listeners
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageListeners = useRef<Set<(msg: any) => void>>(new Set());

    // --- Helper: Send STOMP Frame ---
    const sendFrame = useCallback((command: string, headers: Record<string, string>, body?: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;

        let frame = `${command}\n`;
        for (const [key, value] of Object.entries(headers)) {
            frame += `${key}:${value}\n`;
        }
        frame += '\n'; // End of headers
        if (body) frame += body;
        frame += '\0'; // Null terminator

        wsRef.current.send(frame);
        return true;
    }, []);

    // --- Subscription Listener Registration ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage = useCallback((callback: (msg: any) => void) => {
        messageListeners.current.add(callback);
        return () => {
            messageListeners.current.delete(callback);
        };
    }, []);

    // --- Request / Response Pattern ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = useCallback((destination: string, bodyObj: any, timeoutMs = 10000): Promise<StompResponse> => {
        return new Promise((resolve, reject) => {
            const reqId = uuidv4();
            const payload = { ...bodyObj, reqId };

            pendingRequests.current.set(reqId, { resolve, reject });

            setTimeout(() => {
                if (pendingRequests.current.has(reqId)) {
                    pendingRequests.current.delete(reqId);
                    reject(new Error("Request Timeout"));
                }
            }, timeoutMs);

            const sent = sendFrame("SEND", { destination }, JSON.stringify(payload));
            if (!sent) {
                pendingRequests.current.delete(reqId);
                reject(new Error("WebSocket Not Connected"));
            }
        });
    }, [sendFrame]);

    useEffect(() => {
        if (!enabled || !token) return;

        const wsUrl = `${url}?socket_token=${token}`;
        console.log(`[StompClient] Connecting to ${wsUrl}...`);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[StompClient] Connected. Handshaking...");
            const connectFrame = "CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0";
            ws.send(connectFrame);
        };

        ws.onmessage = (event) => {
            try {
                const data = event.data;
                
                if (data.startsWith("CONNECTED")) {
                    console.log("[StompClient] STOMP Session Established");
                    setIsConnected(true);
                    
                    // Trigger onConnect callback to let caller subscribe
                    if (onConnect) {
                         onConnect((cmd, hdrs, bdy) => {
                             // Minimal send implementation for callback
                             if (ws.readyState === WebSocket.OPEN) {
                                let f = `${cmd}\n`;
                                for (const [k, v] of Object.entries(hdrs)) f += `${k}:${v}\n`;
                                f += '\n';
                                if (bdy) f += bdy;
                                f += '\0';
                                ws.send(f);
                             }
                         });
                    }

                } else if (data.startsWith("MESSAGE")) {
                    const bodyIndex = data.indexOf("\n\n");
                    if (bodyIndex !== -1) {
                        const rawBody = data.substring(bodyIndex + 2).replace(/\0$/, '');
                        if (rawBody) {
                            const parseData = JSON.parse(rawBody);

                            // 1. Notify global listeners
                            messageListeners.current.forEach(listener => listener(parseData));

                            // 2. Resolver pending requests
                            if (parseData.correlationId && pendingRequests.current.has(parseData.correlationId)) {
                                const { resolve } = pendingRequests.current.get(parseData.correlationId)!;
                                resolve(parseData);
                                pendingRequests.current.delete(parseData.correlationId);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("[StompClient] Parse Error:", err);
            }
        };

        ws.onclose = () => {
            console.log("[StompClient] Disconnected");
            setIsConnected(false);
        };

        ws.onerror = (err) => {
            console.error("[StompClient] WebSocket Error", err);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            setIsConnected(false);
        };
    }, [url, enabled, token, onConnect]);

    return {
        isConnected,
        request,
        send: sendFrame,
        onMessage
    };
}
