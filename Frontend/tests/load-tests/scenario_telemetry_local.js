import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { TEST_USERS } from './config.js';

// --- Local Configuration Override ---
const LOCAL_BASE_URL = 'http://localhost:8080';
const LOCAL_WS_URL = 'ws://localhost:8080/ws-server/websocket';

const e2eLatencyTrend = new Trend('latency_e2e');      // Edge -> Observer
const backendLatencyTrend = new Trend('latency_backend'); // Server -> Observer
const receivedCounter = new Counter('ws_msgs_received');

export const options = {
    scenarios: {
        controller_view: {
            executor: 'constant-vus',
            vus: 10,           // 10명의 관제사가 동시에 접속한 상황 시뮬레이션
            duration: '5m',    // 5분 동안 지속
            exec: 'observeTraffic'
        }
    },
    thresholds: {
        'latency_e2e': ['p(95)<500'], 
        'latency_backend': ['p(95)<100'],
        'ws_msgs_received': ['count>10000'],
    }
};

export function setup() {
    console.log(`[Setup] Logging in to LOCAL: ${LOCAL_BASE_URL}...`);
    const loginUrl = `${LOCAL_BASE_URL}/api/auth/login`;
    const payload = JSON.stringify({
        email: TEST_USERS.ADMIN.email,
        password: TEST_USERS.ADMIN.password
    });
    const params = {
        headers: { 'Content-Type': 'application/json' },
        timeout: '30s', // Give it enough time
    };

    const res = http.post(loginUrl, payload, params);
    
    if (res.status !== 200) {
        console.error(`[Setup] ❌ Login Failed! Status: ${res.status}`);
        console.error(`[Setup] ❌ Response Body: ${res.body}`);
        return { token: null, error: res.status };
    }

    const socketToken = res.json('socketToken');
    if (!socketToken) {
        console.error(`[Setup] ❌ Login Success but 'socketToken' is missing in response! Body: ${res.body}`);
        return { token: null, error: 'no_token' };
    }

    console.log(`[Setup] ✅ Login Success. Socket Token obtained.`);
    return { token: socketToken };
}

export function observeTraffic(data) {
    if (!data || !data.token) {
        // If it's a tight loop of errors, we should sleep to avoid flooding
        console.error(`[Observer] 🛑 No valid token from setup (Error: ${data ? data.error : 'unknown'}). Skipping VU iteration...`);
        sleep(5);
        return;
    }

    const fullUrl = `${LOCAL_WS_URL}?socket_token=${data.token}`;
    let loggedFrames = 0;

    console.log(`[Observer] Connecting to LOCAL WebSocket...`);

    const res = ws.connect(fullUrl, {}, function (socket) {
        socket.on('open', function open() {
            console.log('[Observer] WS Open. Handshaking STOMP...');
            socket.send('CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0');
        });

        socket.on('message', (data) => {
            if (data.startsWith('CONNECTED')) {
                console.log('[Observer] STOMP Protocol Handshake SUCCESS ✅');
                const subDest = '/topic/towingcar/*';
                const subFrame = `SUBSCRIBE\nid:sub-telemetry\ndestination:${subDest}\n\n\0`;
                socket.send(subFrame);
                console.log(`[Observer] Subscribed to ${subDest} (Local Mock Mode)`);
            }

            if (data.startsWith('MESSAGE')) {
                const parts = data.split('\n\n');
                if (parts.length >= 2) {
                    const bodyStr = parts[1].replace(/\0$/, '');
                    try {
                        const body = JSON.parse(bodyStr);
                        const now = Date.now();

                        // 1. E2E Latency (Edge -> Observer)
                        if (body.edgeTs) {
                            e2eLatencyTrend.add(now - body.edgeTs);
                        }

                        // 2. Backend Latency (Server -> Observer)
                        if (body.serverTs) {
                            backendLatencyTrend.add(now - body.serverTs);
                        }

                        // 메시지 수신 성공을 'check'로 기록
                        check(body, { 'valid telemetry data': (b) => b.carId !== undefined || b.car_id !== undefined });
                        
                        receivedCounter.add(1);
                    } catch (e) {}
                }
            }
        });

        socket.on('error', (e) => console.error(`[Observer] WebSocket Error: ${e}`));

        // Graceful Shutdown: 테스트 종료 10초 전에 연결 닫기 (Interrupted Iteration 방지)
        socket.setTimeout(() => {
            console.log('[Observer] Closing connection gracefully before timeout...');
            socket.close();
        }, 290000); // 5m (300s) - 10s = 290s
    });

    check(res, {
        'status is 101': (r) => r && r.status === 101,
    });
}
