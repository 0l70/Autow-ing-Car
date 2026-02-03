import ws from 'k6/ws';
import { check } from 'k6';
import { WS_URL } from './config.js';

export const options = {
    scenarios: {
        spike_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '5s', target: 500 },   // 5초 만에 500명 접속 (급증)
                { duration: '1m', target: 500 },   // 1분간 유지
                { duration: '10s', target: 0 },
            ],
            gracefulStop: '30s',
        }
    },
};

// Login Bypass Token
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdGNAYXRjLmNvbSIsImF1dGgiOiJST0xFX0FUQyIsInRva2VuX3R5cGUiOiJTT0NLRVQiLCJpYXQiOjE3NzAwOTIyMjksImV4cCI6MTc3MDA5NTgyOX0.zAQlf7DSlk9oaSV5tUIdxXu_92EUNgtZB_aH3wVoJzI";

export default function () {
    const fullUrl = `${WS_URL}?socket_token=${TOKEN}`;

    const response = ws.connect(fullUrl, {}, function (socket) {
        socket.on('open', function open() {
            socket.send('CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0');
            // 별도 메시지 전송 없이 접속 폭주만 테스트
        });

        socket.on('close', () => console.log('Disconnected'));
        
        socket.setTimeout(function () {
             // 5초만에 500명이 들어왔을 때 서버가 뻗지 않는지가 관건
        }, 70000); 
    });

    check(response, { 
        'status is 101': (r) => {
            if (r && r.status !== 101) {
                // 로그 폭탄 방지를 위해 가끔만 출력
                if (Math.random() < 0.01) { 
                    console.error(`❌ Handshake Failed. Status: ${r.status}`);
                }
            }
            return r && r.status === 101; 
        }
    });
}
