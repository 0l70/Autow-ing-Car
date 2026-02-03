import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { WS_URL } from './config.js';

export const options = {
    scenarios: {
        soak_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '2m', target: 200 },  // 2분 동안 200명까지 서서히 증가
                { duration: '56m', target: 200 }, // 56분 동안 유지 (Soak)
                { duration: '2m', target: 0 },    // 2분 동안 서서히 감소 (총 60분)
            ],
            gracefulStop: '30s',
        }
    },
};

// Login Bypass Token (기존 토큰 재사용)
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdGNAYXRjLmNvbSIsImF1dGgiOiJST0xFX0FUQyIsInRva2VuX3R5cGUiOiJTT0NLRVQiLCJpYXQiOjE3NzAwOTIyMjksImV4cCI6MTc3MDA5NTgyOX0.zAQlf7DSlk9oaSV5tUIdxXu_92EUNgtZB_aH3wVoJzI";

export default function () {
    const fullUrl = `${WS_URL}?socket_token=${TOKEN}`;

    const response = ws.connect(fullUrl, {}, function (socket) {
        socket.on('open', function open() {
            socket.send('CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0');
            // Ping (Heartbeat) 로직은 Netty 서버 설정에 따라 자동 처리되거나
            // 필요 시 주기적으로 빈 메시지를 보낼 수 있음
            
            // 5초마다 주기적으로 메시지 전송 (Heartbeating + Activity)
            socket.setInterval(function timeout() {
                 const dest = "/app/flight/info/request"; 
                 const payload = JSON.stringify({ ping: Date.now() });
                 const frame = `SEND\ndestination:${dest}\ncontent-type:application/json\n\n${payload}\0`;
                 socket.send(frame);
            }, 5000);
        });

        socket.on('close', () => console.log('Disconnected'));
        
        // 1시간+@ 동안 연결 유지 (테스트 종료될 때까지)
        // k6 stages duration에 의해 자동 종료되므로 여기서는 무한 대기 or 충분히 긴 시간 설정
        socket.setTimeout(function () {
             // Do nothing, let execution duration handle it
        }, 3600000 + 60000); // 1시간 + 1분
    });

    check(response, { 'status is 101': (r) => r && r.status === 101 });
}
