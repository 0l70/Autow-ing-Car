import { useEffect, useRef, useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export interface StompClientOptions {
  url: string;
  token?: string | null;
  enabled?: boolean; 
  onConnect?: (
    send: (cmd: string, headers: Record<string, string>, body?: string) => void,
  ) => void;
  onDisconnect?: () => void;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}

export interface StompResponse {
  correlationId?: string;
  status?: "SUCCESS" | "FAIL" | "ACCEPTED" | "REJECTED";
  message?: string;
  [key: string]: any;
}

export function useStompClient({
  url,
  token,
  enabled = true,
  onConnect,
  onDisconnect,
  reconnectDelay = 1000,
  maxReconnectDelay = 30000,
}: StompClientOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const pendingRequests = useRef<
    Map<
      string,
      { resolve: (val: StompResponse) => void; reject: (err: Error) => void }
    >
  >(new Map());

  const messageListeners = useRef<Set<(msg: any) => void>>(new Set());

  const sendFrame = useCallback(
    (command: string, headers: Record<string, string>, body?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
        return false;

      let frame = `${command}\n`;
      for (const [key, value] of Object.entries(headers)) {
        frame += `${key}:${value}\n`;
      }
      frame += "\n"; 
      if (body) frame += body;
      frame += "\0"; 

      wsRef.current.send(frame);
      return true;
    },
    [],
  );

  const onMessage = useCallback((callback: (msg: any) => void) => {
    messageListeners.current.add(callback);
    return () => {
      messageListeners.current.delete(callback);
    };
  }, []);

  const request = useCallback(
    (
      destination: string,
      bodyObj: any,
      timeoutMs = 10000,
    ): Promise<StompResponse> => {
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

        const sent = sendFrame(
          "SEND",
          { destination },
          JSON.stringify(payload),
        );
        if (!sent) {
          pendingRequests.current.delete(reqId);
          reject(new Error("WebSocket Not Connected"));
        }
      });
    },
    [sendFrame],
  );

  const connect = useCallback(() => {
    if (!enabled || !token) return;

    const wsUrl = `${url}?socket_token=${token}`;
    console.log(`[StompClient] Connecting (Attempt ${reconnectAttempts.current + 1})...`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[StompClient] Connected. Handshaking...");
      const connectFrame =
        "CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0";
      ws.send(connectFrame);
    };

    ws.onmessage = (event) => {
      const data = event.data;
      if (data === "\n" || data === "\r\n") return; // Heartbeat ignore

      try {
        if (data.startsWith("CONNECTED")) {
          console.log("[StompClient] STOMP Session Established");
          setIsConnected(true);
          reconnectAttempts.current = 0;
          
          // Start Heartbeat
          if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
          heartbeatTimer.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send("\n");
          }, 10000);

          if (onConnect) {
            onConnect((cmd, hdrs, bdy) => {
              if (ws.readyState === WebSocket.OPEN) {
                let f = `${cmd}\n`;
                for (const [k, v] of Object.entries(hdrs)) f += `${k}:${v}\n`;
                f += "\n";
                if (bdy) f += bdy;
                f += "\0";
                ws.send(f);
              }
            });
          }
        } else if (data.startsWith("MESSAGE")) {
          const lines = data.split("\n");
          const headers: Record<string, string> = {};
          let bodyIndex = -1;

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line === "") {
              bodyIndex = i + 1;
              break;
            }
            const parts = line.split(":");
            if (parts.length >= 2) {
              headers[parts[0]] = parts.slice(1).join(":");
            }
          }

          if (bodyIndex !== -1) {
            const rawBody = lines.slice(bodyIndex).join("\n").replace(/\0$/, "");
            if (rawBody) {
              try {
                const parseData = JSON.parse(rawBody);
                const destination = headers["destination"];
                const messageWrapper = { destination, body: parseData, headers };

                messageListeners.current.forEach((listener) => listener(messageWrapper));

                const corrId = parseData.correlationId || headers["correlation-id"];
                if (corrId && pendingRequests.current.has(corrId)) {
                  const { resolve } = pendingRequests.current.get(corrId)!;
                  resolve(parseData);
                  pendingRequests.current.delete(corrId);
                }
              } catch (e) {
                console.error("[StompClient] JSON Parse Error:", e);
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
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (onDisconnect) onDisconnect();

      // Exponential Backoff
      if (enabled) {
        const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
        console.log(`[StompClient] Retrying in ${delay}ms...`);
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (err) => {
      console.error("[StompClient] WebSocket Error", err);
    };
  }, [url, enabled, token, onConnect, onDisconnect, reconnectDelay, maxReconnectDelay]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return {
    isConnected,
    request,
    send: sendFrame,
    onMessage,
  };
}
