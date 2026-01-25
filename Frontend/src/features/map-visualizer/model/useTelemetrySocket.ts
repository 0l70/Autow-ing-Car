import { useEffect, useRef, useCallback } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { Aircraft } from '@/entities/map/model/types';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import { v4 as uuidv4 } from 'uuid';

// TODO: .env 파일로 이동 필요
// 원격 개발 서버
// const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://i14a402.p.ssafy.io:8080/ws-server/websocket';
// 로컬 개발 서버
const WS_URL_DEV = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080/ws/telemetry'; // TEST: Connect to local Mock Server


interface ResponseMessage {
    correlationId?: string;
    status?: 'SUCCESS' | 'FAIL' | 'ACCEPTED' | 'REJECTED';
    message?: string;
    data?: any;
    [key: string]: any;
}

export function useTelemetrySocket(url: string = WS_URL_DEV, enabled: boolean = true) {
    const { updateAircraft } = useGraphStore();
    const { token } = useAuthStore();
    const wsRef = useRef<WebSocket | null>(null);

    // Dispatcher: 요청 ID(CorrelationId)와 Promise(resolve, reject)를 매핑하여 저장
    const pendingRequests = useRef<Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>>(new Map());

    // --- Global Message Listeners ---
    // 컴포넌트가 특정 이벤트를 듣고 싶을 때 등록할 수 있는 콜백 목록
    const messageListeners = useRef<Set<(msg: any) => void>>(new Set());

    const onMessage = useCallback((callback: (msg: any) => void) => {
        messageListeners.current.add(callback);
        return () => {
            messageListeners.current.delete(callback);
        };
    }, []);

    // --- 헬퍼: STOMP 프레임 전송 ---
    const sendFrame = useCallback((command: string, headers: Record<string, string>, body?: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;

        let frame = `${command}\n`;
        for (const [key, value] of Object.entries(headers)) {
            frame += `${key}:${value}\n`;
        }
        frame += '\n'; // 헤더 끝
        if (body) frame += body;
        frame += '\0'; // NULL 종료 문자

        wsRef.current.send(frame);
        return true;
    }, []);

    // --- 핵심: 요청 전송 및 응답 대기 (Request-Response) ---
    const request = useCallback((destination: string, bodyObj: any, timeoutMs = 10000): Promise<ResponseMessage> => {
        return new Promise((resolve, reject) => {
            const reqId = uuidv4();
            // 프로토콜에 따라 요청 시에는 reqId 필드를 사용
            const payload = { ...bodyObj, reqId };

            // 1. 대기 중인 요청 목록에 등록 (Key는 reqId와 동일한 값)
            pendingRequests.current.set(reqId, { resolve, reject });

            // 2. 타임아웃 설정 (시간 초과 시 정리)
            setTimeout(() => {
                if (pendingRequests.current.has(reqId)) {
                    pendingRequests.current.delete(reqId);
                    reject(new Error("Request Timeout"));
                }
            }, timeoutMs);

            // 3. 메시지 전송
            const sent = sendFrame("SEND", { destination }, JSON.stringify(payload));
            if (!sent) {
                pendingRequests.current.delete(reqId);
                reject(new Error("WebSocket Not Connected"));
            }
        });
    }, [sendFrame]);

    useEffect(() => {
        if (!enabled || !token) return;

        const wsUrl = `${url}?token=${token}`;
        console.log(`[TelemetrySocket] Connecting to ${wsUrl}...`);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[TelemetrySocket] Connected. Sending STOMP CONNECT...");
            const connectFrame = "CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0";
            ws.send(connectFrame);
        };

        ws.onmessage = (event) => {
            try {
                const data = event.data;
                // console.log("[TelemetrySocket] Raw Data:", data);

                if (data.startsWith("CONNECTED")) {
                    // console.log("[TelemetrySocket] STOMP CONNECTED. Subscribing...");

                    // 1. 모니터링 채널 구독 (Broadcast)
                    ws.send("SUBSCRIBE\nid:sub-0\ndestination:/topic/car/*/monitoring\n\n\0");

                    // 2. 응답 채널 구독 (Responses)
                    // 참고: 백엔드가 UserDestination을 지원한다면 /user/queue/reply가 이상적입니다.
                    // 현재는 범용 응답 채널을 구독한다고 가정합니다.
                    ws.send("SUBSCRIBE\nid:sub-1\ndestination:/topic/app/responses\n\n\0");

                } else if (data.startsWith("MESSAGE")) {
                    const bodyIndex = data.indexOf("\n\n");
                    if (bodyIndex !== -1) {
                        const rawBody = data.substring(bodyIndex + 2).replace(/\0$/, '');
                        if (rawBody) {
                            const parseData = JSON.parse(rawBody);

                            // 리스너들에게 전파
                            messageListeners.current.forEach(listener => listener(parseData));

                            // --- DISPATCHER 로직 ---
                            // 프로토콜: 응답은 'correlationId'에 요청했던 'reqId'를 담아 보냄
                            if (parseData.correlationId && pendingRequests.current.has(parseData.correlationId)) {
                                const { resolve } = pendingRequests.current.get(parseData.correlationId)!;
                                resolve(parseData);
                                pendingRequests.current.delete(parseData.correlationId);
                                // console.log(`[TelemetrySocket] Request Resolved: ${parseData.correlationId}`);
                                return; // 응답으로 처리되었으므로 여기서 종료
                            }

                            // --- 모니터링 로직 ---
                            // 특정 응답이 아니라면 일반 텔레메트리 데이터로 처리
                            // (Aircraft 객체 형태인 경우에만)
                            if (parseData.car_id || parseData.carId) {
                                const aircraft: Aircraft = {
                                    id: parseData.car_id || parseData.carId || 'Unknown',
                                    callsign: parseData.car_id || parseData.carId || 'Unknown',

                                    type: 'TUG',
                                    position: {
                                        x: parseData.x || 0,
                                        y: parseData.y || 0,
                                        r: (parseData.yaw || 0) * (Math.PI / 180)
                                    },
                                    status: parseData.mode || 'IDLE',
                                    battery: parseData.battery || 0,
                                    speed: parseData.v || 0,
                                    currentMission: parseData.currentMission,
                                    isLoaded: parseData.is_loaded || false
                                };
                                updateAircraft(aircraft);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("[TelemetrySocket] Parse Error:", err);
            }
        };

        ws.onclose = () => {
            console.log("[TelemetrySocket] Disconnected");
        };

        ws.onerror = (err) => {
            console.error("[TelemetrySocket] Error:", err);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [url, enabled, updateAircraft, token]);

    return {
        isConnected: wsRef.current?.readyState === WebSocket.OPEN,
        request, // Promise 기반 요청 함수 내보내기
        send: sendFrame, // 필요 시 원시 전송 함수 내보내기
        onMessage // 글로벌 메시지 리스너 등록 함수
    };
}
