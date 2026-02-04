import { MapMeta, GraphNode, GraphEdge } from "../model/types";

// Simulated Map Metadata (e.g., received from Edge Server)
// 100m x 100m area, 0.05m/pixel resolution => 2000x2000 pixels
export const MOCK_MAP_META: MapMeta = {
    image: "mock_grid", // Virtual image name
    resolution: 0.05,
    origin: [0, 0, 0],
    negate: false,
    occupied_thresh: 0.65,
    free_thresh: 0.196,
    mode: "raw"
};

// Virtual Map Size for Grid Rendering
export const MOCK_MAP_SIZE = {
    width: 327,
    height: 275
};

// Generate some futuristic Looking Nodes
export const MOCK_NODES: GraphNode[] = [
    // RUNWAY / TAXIWAY CENTER
    { id: "n1", x: 50, y: 37.5, type: 'RUNWAY', label: 'RWY-01' },
    { id: "n2", x: 20, y: 37.5, type: 'INTERSECTION', label: 'INT-A' },
    { id: "n3", x: 80, y: 37.5, type: 'INTERSECTION', label: 'INT-B' },
    
    // GATES (Top)
    { id: "g1", x: 30, y: 60, type: 'GATE', label: 'G-01' },
    { id: "g2", x: 50, y: 60, type: 'GATE', label: 'G-02' },
    { id: "g3", x: 70, y: 60, type: 'GATE', label: 'G-03' },

    // PARKING (Bottom)
    { id: "p1", x: 30, y: 15, type: 'CHARGER', label: 'CHG-1' },
    { id: "p2", x: 70, y: 15, type: 'CHARGER', label: 'CHG-2' },
];

export const MOCK_EDGES: GraphEdge[] = [
    // Main Artery
    { id: "e1", fromId: "n2", toId: "n1", bidirectional: true, cost: 30, waypoints: [] },
    { id: "e2", fromId: "n1", toId: "n3", bidirectional: true, cost: 30, waypoints: [] },
    
    // Gate Branches
    { id: "e3", fromId: "n2", toId: "g1", bidirectional: true, cost: 25, waypoints: [] },
    { id: "e4", fromId: "n1", toId: "g2", bidirectional: true, cost: 22.5, waypoints: [] },
    { id: "e5", fromId: "n3", toId: "g3", bidirectional: true, cost: 25, waypoints: [] },

    // Parking Connectors
    { id: "e6", fromId: "n2", toId: "p1", bidirectional: true, cost: 25, waypoints: [] },
    { id: "e7", fromId: "n3", toId: "p2", bidirectional: true, cost: 25, waypoints: [] },
];
