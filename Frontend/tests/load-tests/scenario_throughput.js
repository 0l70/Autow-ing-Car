import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { WS_URL } from './config.js';

export const options = {
    scenarios: {
        throughput: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 500 },  // 50명 동시 접속
                { duration: '1m', target: 500 },   // 유지
                { duration: '10s', target: 0 },
            ],
            // Graceful stop을 넉넉히 주어 연결 종료 처리 보장
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
            
            // 연결 후 1초마다 메시지 전송 (Throughput Test)
            socket.setInterval(function timeout() {
                // 비행 정보 요청 (Read-only Operation)
                // 서버가 이 요청을 받고 처리하는 부하를 테스트함
                const payload = JSON.stringify({ reqId: Date.now() });
                const dest = "/app/flight/info/request";
                
                const frame = `SEND\ndestination:${dest}\ncontent-type:application/json\n\n${payload}\0`;
                socket.send(frame);
            }, 1000); // 1초에 1번 전송
        });

        socket.on('message', function (message) {
            // 서버 응답 확인 (선택 사항)
            // if (message.startsWith("MESSAGE")) console.log("Received response");
        });

        socket.on('close', () => console.log('Disconnected'));

        // 30초 동안 연결 유지
        socket.setTimeout(function () {
            socket.close();
        }, 30000);
    });

    check(response, { 'status is 101': (r) => r && r.status === 101 });
}
