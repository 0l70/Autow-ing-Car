import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`[MockServer] Starting WebSocket Server on ws://localhost:${PORT}/ws/telemetry`);

// Mock Data State
let aircrafts = [
    { id: "TC01", x: 20, y: 20, yaw: 0, mode: "MOVING" },
    { id: "TC02", x: 40, y: 40, yaw: 90, mode: "MOVING" }
];

wss.on('connection', (ws) => {
    console.log('[MockServer] Client Connected');

    // --- STOMP 모의 구현 ---
    ws.on('message', (message) => {
        const msgStr = message.toString();
        // console.log('[MockServer] Received:', msgStr);

        if (msgStr.startsWith("CONNECT")) {
            console.log('[MockServer] Client sent CONNECT');
            const response = "CONNECTED\nversion:1.1\n\n\0";
            ws.send(response);
        }
        else if (msgStr.startsWith("SEND")) {
            // 목적지(Destination) 파싱
            const destMatch = msgStr.match(/destination:(.*)\n/);
            const destination = destMatch ? destMatch[1] : "";

            // 바디(Body) 추출 (JSON)
            const bodyIndex = msgStr.indexOf("\n\n");
            let bodyObj = {};
            if (bodyIndex !== -1) {
                try {
                    const rawBody = msgStr.substring(bodyIndex + 2).replace(/\0$/, '');
                    bodyObj = JSON.parse(rawBody);
                } catch (e) { }
            }

            console.log(`[MockServer] Received SEND to ${destination}`, bodyObj);

            // 토잉카 연결 요청 처리
            if (destination === '/app/car/connect') {
                console.log('[MockServer] Simulating Connection Sequence...');
                const corrId = bodyObj.reqId || bodyObj.correlationId;

                // Step 1: 바로 승인 (Approved)
                setTimeout(() => {
                    const approvedMsg = {
                        type: 'CONNECT_APPROVED',
                        correlationId: corrId,
                        assignedCarId: 'TUG-004',
                        message: '관제 승인 완료. 차량 이동 중...'
                    };
                    // User Queue가 아닌 Topic으로 브로드캐스트 (개발 편의)
                    ws.send(`MESSAGE\ndestination:/topic/app/responses\n\n${JSON.stringify(approvedMsg)}\0`);
                    console.log('[MockServer] Sent CONNECT_APPROVED');
                }, 500);

                // Step 2: 3초 후 연결 완료 (Completed)
                setTimeout(() => {
                    const completedMsg = {
                        type: 'CONNECT_COMPLETED',
                        assignedCarId: 'TUG-004',
                        message: '토잉카 연결이 완료되었습니다.'
                    };
                    ws.send(`MESSAGE\ndestination:/topic/app/responses\n\n${JSON.stringify(completedMsg)}\0`);
                    console.log('[MockServer] Sent CONNECT_COMPLETED');
                }, 3500);
            }
            // 토잉카 연결 해제 요청 처리
            else if (destination === '/app/car/disconnect') {
                console.log('[MockServer] Simulating Disconnection Sequence...');
                const corrId = bodyObj.reqId || bodyObj.correlationId;

                // Step 1: 바로 승인 (Approved)
                setTimeout(() => {
                    const approvedMsg = {
                        type: 'DISCONNECT_APPROVED',
                        correlationId: corrId,
                        assignedCarId: 'TUG-004',
                        message: '해제 승인 완료. 분리 중...'
                    };
                    ws.send(`MESSAGE\ndestination:/topic/app/responses\n\n${JSON.stringify(approvedMsg)}\0`);
                    console.log('[MockServer] Sent DISCONNECT_APPROVED');
                }, 500);

                // Step 2: 2초 후 해제 완료 (Completed)
                setTimeout(() => {
                    const completedMsg = {
                        type: 'DISCONNECT_COMPLETED',
                        assignedCarId: 'TUG-004',
                        message: '토잉카 연결이 해제되었습니다.'
                    };
                    ws.send(`MESSAGE\ndestination:/topic/app/responses\n\n${JSON.stringify(completedMsg)}\0`);
                    console.log('[MockServer] Sent DISCONNECT_COMPLETED');
                }, 2500);
            }
        }
        else if (msgStr.startsWith("SUBSCRIBE")) {
            // 구독 요청은 로그만 남기거나 무시
            // console.log('[MockServer] Client Subscribed');
        }
    });

    // Send data every 100ms (10Hz)
    const interval = setInterval(() => {
        aircrafts.forEach(ac => {
            // 이동 시뮬레이션
            if (ac.mode === 'MOVING') {
                ac.x += (Math.random() - 0.5) * 5;
                ac.y += (Math.random() - 0.5) * 5;
                ac.yaw += (Math.random() - 0.5) * 10;
            }

            // MQTT 스타일 페이로드 생성 (STOMP 형식)
            const payload = {
                carId: ac.id,
                mode: ac.mode,
                battery_pct: Math.floor(Math.random() * 20) + 80, // 80-99%
                velocity_mps: 2.5,
                x_m: ac.x,
                y_m: ac.y,
                yaw_deg: ac.yaw,
                currentMission: ac.mode === 'MOVING' ? 'DELIVERY_A' : null,
                is_loaded: false
            };

            if (ws.readyState === ws.OPEN) {
                // STOMP MESSAGE 형식으로 포맷
                const stompMsg = `MESSAGE\ndestination:/topic/car/${ac.id}/monitoring\n\n${JSON.stringify(payload)}\0`;
                ws.send(stompMsg);
            }
        });
    }, 1000);

    ws.on('close', () => {
        console.log('[MockServer] Client Disconnected');
        clearInterval(interval);
    });
});
