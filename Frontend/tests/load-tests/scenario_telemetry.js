import ws from 'k6/ws';
import { check } from 'k6';
import { WS_URL } from './config.js';

export const options = {
    scenarios: {
        telemetry_ingestion: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 100 },  // 100대의 차량(Pilot) 가정
                { duration: '1m', target: 100 },   // 1분간 데이터 전송
                { duration: '10s', target: 0 },
            ],
            gracefulStop: '30s',
        }
    },
};

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdGNAYXRjLmNvbSIsImF1dGgiOiJST0xFX0FUQyIsInRva2VuX3R5cGUiOiJTT0NLRVQiLCJpYXQiOjE3NzAwODMxNjAsImV4cCI6MTc3MDA4Njc2MH0.zvlK710P10le-Cn4hJHIK9CjRodQuWFCYyJ0w2YCeag";

export default function () {
    const fullUrl = `${WS_URL}?socket_token=${TOKEN}`;

    const response = ws.connect(fullUrl, {}, function (socket) {
        socket.on('open', function open() {
            socket.send('CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\0');
            
            // 0.1초(100ms)마다 위치/상태 정보 전송 (Telemetry Simulation)
            // 실제 로직: Pilot이 서버로 'MOVE' 명령을 계속 보낸다고 가정
            socket.setInterval(function timeout() {
                const dest = "/app/car/move";
                // 카 ID는 테스트용 'TC01' 사용
                const payload = JSON.stringify({ 
                    type: "MOVE",
                    carId: "TC01",
                    timestamp: Date.now()
                });
                
                const frame = `SEND\ndestination:${dest}\ncontent-type:application/json\n\n${payload}\0`;
                socket.send(frame);
            }, 100); // 10Hz (초당 10회)
        });

        socket.on('close', () => console.log('Disconnected'));
        
        socket.setTimeout(function () {
             // Keep alive
        }, 70000); 
    });

    check(response, { 'status is 101': (r) => r && r.status === 101 });
}
