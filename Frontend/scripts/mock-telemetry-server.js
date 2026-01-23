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

    // Send data every 100ms (10Hz)
    const interval = setInterval(() => {
        aircrafts.forEach(ac => {
            // Simulate Movement
            if (ac.mode === 'MOVING') {
                ac.x += (Math.random() - 0.5) * 5;
                ac.y += (Math.random() - 0.5) * 5;
                ac.yaw += (Math.random() - 0.5) * 10;
            }

            // Create MQTT-like Payload
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
                ws.send(JSON.stringify(payload));
            }
        });
    }, 1000);

    ws.on('close', () => {
        console.log('[MockServer] Client Disconnected');
        clearInterval(interval);
    });
});
