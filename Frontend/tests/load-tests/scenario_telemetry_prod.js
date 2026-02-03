import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { WS_URL, BASE_URL, TEST_USERS } from './config.js';

// Custom Metrics
const latencyTrend = new Trend('message_latency');
const receivedCounter = new Counter('ws_msgs_received');

export const options = {
    scenarios: {
        controller_view: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 1,
            maxDuration: '5m',
            exec: 'observeTraffic'
        }
    },
    thresholds: {
        'message_latency': ['p(95)<500'], 
        'ws_msgs_received': ['count>100'], 
    }
};

// 1. Setup: Login to get a fresh token
export function setup() {
    console.log(`[Setup] Logging in as ${TEST_USERS.ADMIN.email}...`);
    const loginUrl = `${BASE_URL}/api/auth/login`;
    const payload = JSON.stringify({
        email: TEST_USERS.ADMIN.email,
        password: TEST_USERS.ADMIN.password
    });
    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const res = http.post(loginUrl, payload, params);
    
    if (res.status !== 200) {
        console.error(`[Setup] Login Failed! Status: ${res.status}, Body: ${res.body}`);
        return { token: null };
    }

    const socketToken = res.json('socketToken');
    if (!socketToken) {
        console.error(`[Setup] Login Success but socketToken is missing!`);
        return { token: null };
    }

    console.log(`[Setup] Login Success. Socket Token obtained.`);
    return { token: socketToken };
}

// 2. Main Scenario
export function observeTraffic(data) {
    if (!data || !data.token) {
        console.error('[Observer] No valid token from setup.');
        return;
    }

    const fullUrl = `${WS_URL}?socket_token=${data.token}`;
    let loggedFrames = 0;

    console.log(`[Observer] Connecting to WebSocket...`);

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
                console.log(`[Observer] Listening on: ${subDest}`);
            }

            if (data.startsWith('MESSAGE')) {
                if (loggedFrames < 10) {
                    console.log(`[Observer] 📨 Received MESSAGE! Body: ${data.substring(0, 150)}...`);
                    loggedFrames++;
                }
                const parts = data.split('\n\n');
                if (parts.length >= 2) {
                    const bodyStr = parts[1].replace(/\0$/, '');
                    try {
                        const body = JSON.parse(bodyStr);
                        if (body.timestamp) {
                            latencyTrend.add(Date.now() - body.timestamp);
                            receivedCounter.add(1);
                        }
                    } catch (e) {}
                }
            }

            if (data.startsWith('ERROR')) {
                console.error(`[Observer] STOMP ERROR: ${data}`);
            }
        });

        socket.on('error', (e) => console.error(`[Observer] WebSocket Error: ${e}`));
        
        socket.setTimeout(() => {
            console.log('[Observer] Test Finished.');
            socket.close();
        }, 60000); 
    });

    check(res, {
        'status is 101': (r) => r && r.status === 101,
    });
}
