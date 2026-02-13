
import mqtt from 'mqtt';

/**
 * Mock Edge Device (MQTT Publisher)
 * 
 * Simulates a ROS robot sending Map Data to the Backend via MQTT.
 * Broker: tcp://13.125.137.99:8183 (From application-local.yml)
 * Topic: autowing_car/v1/sys/map
 */

const BROKER_URL = 'tcp://13.125.137.99:8183';
const TOPIC_MAP = 'autowing_car/v1/sys/map';

console.log(`[MockEdge] Connecting to Broker at ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, {
    clientId: 'mock-edge-script-' + Date.now(),
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
});

const MOCK_MAP_PAYLOAD = {
    map_id: "map_production_v1",
    width: 2000,
    height: 1500,
    corners: {
        TR: { x: 50, y: -20 },
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

client.on('connect', () => {
    console.log('[MockEdge] Connected!');
    
    // Publish Map Data
    console.log(`[MockEdge] Publishing to ${TOPIC_MAP}...`);
    client.publish(TOPIC_MAP, JSON.stringify(MOCK_MAP_PAYLOAD), { qos: 1 }, (err) => {
        if (err) {
            console.error('[MockEdge] Publish Failed:', err);
        } else {
            console.log('[MockEdge] Publish Success! Check your Frontend.');
        }
        client.end();
    });
});

client.on('error', (err) => {
    console.error('[MockEdge] Connection Error:', err);
    client.end();
});
