import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, WS_URL, TEST_USERS } from './config.js';

export const options = {
    scenarios: {
        stable_connection: {
            executor: 'constant-vus',
            vus: 500,
            duration: '40s', // 30초+a 동안 500명 유지
        },
    },
};

// 1. 로그인하여 토큰 획득
function getSocketToken() {
    const payload = JSON.stringify({
        email: TEST_USERS.ADMIN.email,
        password: TEST_USERS.ADMIN.password,
    });
    
    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
    
    if (res.status === 200) {
        return res.json('socketToken');
    }
    console.error(`Login failed! Status: ${res.status}, Body: ${res.body}`);
    return null;
}

export default function () {
    // const token = getSocketToken();
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdGNAYXRjLmNvbSIsImF1dGgiOiJST0xFX0FUQyIsInRva2VuX3R5cGUiOiJTT0NLRVQiLCJpYXQiOjE3NzAwOTIyMjksImV4cCI6MTc3MDA5NTgyOX0.zAQlf7DSlk9oaSV5tUIdxXu_92EUNgtZB_aH3wVoJzI";
    if (!token) {
        console.error('Failed to get socket token');
        sleep(1);
        return;
    }

    const fullUrl = `${WS_URL}?socket_token=${token}`;

    const response = ws.connect(fullUrl, {}, function (socket) {
        socket.on('open', function open() {
            // STOMP Connect Frame
            socket.send('CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0');
        });

        socket.on('message', function (message) {
            if (message.startsWith('CONNECTED')) {
                // console.log('STOMP Connected');
                
                // Subscribe to Mission Updates (Topic)
                // STOMP Subscribe Frame
                const subFrame = 'SUBSCRIBE\nid:sub-0\ndestination:/topic/mission/updates\n\n\0';
                socket.send(subFrame);
            }
            
            // Heartbeat check (optional)
        });

        socket.on('close', () => console.log('Disconnected'));
        
        socket.on('error', (e) => {
            if (e.error() != 'websocket: close 1000 (normal)') {
                console.log('An unexpected error occured: ', e.error());
            }
        });

        // 30초 동안 연결 유지
        socket.setTimeout(function () {
            socket.close();
        }, 30000);
    });

    check(response, { 'status is 101': (r) => r && r.status === 101 });
}
