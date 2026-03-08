import mqtt from 'mqtt';

// --- Configuration (Production Aligned) ---
const MQTT_BROKER_URL = 'mqtts://autowingcar.o-r.kr:8883';
const CAR_COUNT = 2; // Only TC01 and TC02 are registered in LocalDataInit.java
const INTERVAL_MS = 100; // 10Hz

const clients = [];
let totalSent = 0;
let connectedCount = 0;

console.log(`[Simulation] Starting ${CAR_COUNT} cars... Target: ${MQTT_BROKER_URL}`);

for (let i = 1; i <= CAR_COUNT; i++) {
    const id = `TC${i.toString().padStart(2, '0')}`;
    
    const client = mqtt.connect(MQTT_BROKER_URL, {
        reconnectPeriod: 2000,
        rejectUnauthorized: false
    });

    client.on('connect', () => {
        const c = clients.find(c => c.id === id);
        if (c && !c.connected) {
            connectedCount++;
            c.connected = true;
        }
    });

    client.on('error', (err) => {
        // console.error(`[${id}] Error:`, err.message);
    });

    client.on('close', () => {
        const c = clients.find(c => c.id === id);
        if (c && c.connected) {
            connectedCount--;
            c.connected = false;
        }
    });

    clients.push({ client, id, connected: false });
}

// Summary Logger
setInterval(() => {
    console.log(`\n[${new Date().toISOString()}] Summary: Connected=${connectedCount}/${CAR_COUNT}, TotalSent=${totalSent}`);
}, 5000);

// Publish Loop (Matches MonitoringHandler.java & useTelemetrySocket.ts)
setInterval(() => {
    const now = Date.now();
    clients.forEach(({ client, id, connected }) => {
        if (connected) {
            // Topic used by Backend MqttTopics.SUB_MONITORING
            const topic = `autowing_car/v1/monitoring`; 
            
            // Payload structure expected by MonitoringHandler & Frontend TelemetrySchema
            const payload = JSON.stringify({
                carId: id,            // Recognized by MonitoringHandler.java (has("carId"))
                x: 1000 + Math.random() * 100,
                y: 750 + Math.random() * 100,
                yaw: Math.random() * 360,
                v: 10,
                mode: 'MOVING_TO_LOAD', // Matches AircraftStatusSchema
                battery: 90,
                is_loaded: false,
                timestamp: now        // For k6 latency measurement
            });
            
            client.publish(topic, payload, { qos: 0 }, (err) => {
                if (!err) totalSent++;
            });
        }
    });
}, INTERVAL_MS);

process.on('SIGINT', () => {
    console.log('\nStopping...');
    clients.forEach(c => c.client.end());
    process.exit();
});
