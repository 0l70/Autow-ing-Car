
import { WebSocketServer } from 'ws';
import http from 'http';

/**
 * Mock Backend Server (HTTP + WebSocket)
 * 
 * 1. HTTP Server: Handles /api/auth/login
 * 2. WebSocket Server: Handles /ws/telemetry (STOMP)
 * 
 * Port: 8080
 */

const PORT = 8080;

// HTTP Server for Login
const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Mock Login Endpoint
    if (req.method === 'POST' && req.url === '/api/auth/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            console.log('< POST /api/auth/login', body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                accessToken: "mock-access-token-" + Date.now(),
                socketToken: "mock-socket-token",
                role: "ATC", // Default to ATC
                grantType: "Bearer"
            }));
            console.log('> 200 OK (Mock Login Success)');
        });
        return;
    }

    // 404 for others
    res.writeHead(404);
    res.end('Not Found');
});

// WebSocket Server attached to HTTP Server
const wss = new WebSocketServer({ server });

console.log(`[MockServer] Starting HTTP + WS on port ${PORT}`);

// Mock Map Data (Matches mqtt_map_interface_final.md & MOCK_NODES in frontend)
const MOCK_MAP_PAYLOAD = {
    map_id: "map_mock_v1",
    width: 2000,
    height: 1500,
    corners: {
        TR: { x: 50, y: -20 }, // Example meters
        TL: { x: -50, y: -20 },
        BL: { x: -50, y: 55 },
        BR: { x: 50, y: 55 }
    },
    nodes: [
        { id: "n1", label: "RWY-01", type: "RUNWAY", x: 0, y: 30 },
        { id: "n2", label: "INT-A", type: "INTERSECTION", x: -25, y: 30 },
        { id: "n3", label: "INT-B", type: "INTERSECTION", x: 25, y: 30 },
        { id: "g1", label: "G-01", type: "GATE", x: -20, y: 50 },
        { id: "g2", label: "G-02", type: "GATE", x: 0, y: 50 },
        { id: "g3", label: "G-03", type: "GATE", x: 20, y: 50 }
    ],
    edges: [
        { id: "e1", from: "n2", to: "n1", cost: 10 },
        { id: "e2", from: "n1", to: "n3", cost: 10 },
        { id: "e3", from: "n2", to: "g1", cost: 8 },
        { id: "e4", from: "n1", to: "g2", cost: 8 },
        { id: "e5", from: "n3", to: "g3", cost: 8 }
    ]
};

// Utils to frame STOMP messages
function makeStompMessage(command, headers, body) {
    let frame = `${command}\n`;
    for (const [key, value] of Object.entries(headers)) {
        frame += `${key}:${value}\n`;
    }
    frame += '\n'; // End of headers
    if (body) frame += typeof body === 'string' ? body : JSON.stringify(body);
    frame += '\0';
    return frame;
}

wss.on('connection', (ws) => {
    console.log('[MockServer] Client Connected');
    
    ws.on('message', (data) => {
        const msg = data.toString();
        
        if (msg.startsWith('CONNECT')) {
            console.log('< CONNECT Frame');
            ws.send(makeStompMessage('CONNECTED', { version: '1.1' }));
            console.log('> CONNECTED Frame');
        } 
        else if (msg.startsWith('SUBSCRIBE')) {
            // Extract destination
            const dstMatch = msg.match(/destination:(.*)/);
            const idMatch = msg.match(/id:(.*)/);
            const dst = dstMatch ? dstMatch[1].trim() : '';
            const subId = idMatch ? idMatch[1].trim() : '0';
            
            console.log(`< SUBSCRIBE: ${dst} (id: ${subId})`);
            
            // If subscribing to Map Info, send it immediately (Retained)
            if (dst.includes('sys/map/info')) {
                console.log('> Sending MAP_INFO payload...');
                ws.send(makeStompMessage('MESSAGE', {
                    'subscription': subId,
                    'message-id': `msg-${Date.now()}`,
                    'destination': dst,
                    'content-type': 'application/json'
                }, JSON.stringify(MOCK_MAP_PAYLOAD)));
            }
            
            // Start sending Telemetry if monitoring
            if (dst.includes('monitoring')) {
                startTelemetry(ws, subId, dst);
            }
        }
    });

    ws.on('close', () => {
        console.log('[MockServer] Client Disconnected');
    });
});

function startTelemetry(ws, subId, dst) {
    console.log('> Starting Telemetry Stream...');
    let angle = 0;
    const interval = setInterval(() => {
        if (ws.readyState !== 1) { // OPEN
            clearInterval(interval);
            return;
        }

        angle += 0.05;
        // Circular path
        const x = Math.cos(angle) * 20;
        const y = Math.sin(angle) * 10 + 30;
        const yaw = angle + Math.PI / 2; // Tangent

        const telemetry = {
            car_id: "TUG_001",
            x: x, // Meters
            y: y, // Meters
            yaw: yaw, // Radians
            v: 5.0,
            mode: "MOVING",
            battery: 85 + Math.sin(angle)*5
        };

        ws.send(makeStompMessage('MESSAGE', {
            'subscription': subId,
            'message-id': `tel-${Date.now()}`,
            'destination': dst,
            'content-type': 'application/json'
        }, JSON.stringify(telemetry)));

    }, 100); // 10Hz
}

// Start Server
server.listen(PORT, () => {
    console.log(`[MockServer] Listening on http://localhost:${PORT}`);
});
