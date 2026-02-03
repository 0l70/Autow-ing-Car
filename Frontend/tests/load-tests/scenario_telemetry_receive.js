import ws from 'k6/ws';
import { check } from 'k6';
import { WS_URL } from './config.js';

export const options = {
    scenarios: {
        telemetry_receive: {
            executor: 'per-vu-iterations',
            vus: 1, // 관제사 1명
            iterations: 1,
            maxDuration: '1m', // 1분 동안 수신
        }
    },
};

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdGNAYXRjLmNvbSIsImF1dGgiOiJST0xFX0FUQyIsInRva2VuX3R5cGUiOiJTT0NLRVQiLCJpYXQiOjE3NzAwODMxNjAsImV4cCI6MTc3MDA4Njc2MH0.zvlK710P10le-Cn4hJHIK9CjRodQuWFCYyJ0w2YCeag";

export default function () {
    const fullUrl = `${WS_URL}?socket_token=${TOKEN}`;

    const response = ws.connect(fullUrl, {}, function (socket) {
        socket.on('open', function open() {
            console.log('Connected to WS');
            socket.send('CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0');
            
            // 1초 뒤 구독 (Connection 안정화 후)
            socket.setTimeout(function() {
                // 전체 차량 모니터링 구독 (carId = '*')
                const subFrame = 'SUBSCRIBE\nid:sub-monitor-all\ndestination:/topic/towingcar/*\n\n\0';
                socket.send(subFrame);
                console.log('Subscribed to /topic/towingcar/*');
            }, 1000);
        });

        // 메시지 수신 로깅 (너무 많으면 주석 처리)
        // socket.on('message', (msg) => console.log(`Received: ${msg.length} bytes`));
        
        socket.on('close', () => console.log('Disconnected'));
        
        // 30초 동안 데이터 수신 대기
        socket.setTimeout(function () {
            socket.close();
        }, 30000); 
    });

    check(response, { 'status is 101': (r) => r && r.status === 101 });
}
