import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { GraphNode, GraphEdge, NodeType } from './types';

interface GraphState {
  // Data
  nodes: GraphNode[];
  edges: GraphEdge[];
  mapMeta: import('./types').MapMeta | null;
  corners: import('@/shared/realtime/api/map.schema').MapCorners | null;
  mapWidth: number;
  mapHeight: number;

  
  // Editor State
  selectedId: string | null;           // ID of selected Node or Edge
  hoveredId: string | null;            // ID of hovered item
  interactionMode: 'SELECT' | 'NODE' | 'EDGE'; // Current Tool
  
  // Node Creation State
  activeNodeType: NodeType;            // What type of node to create next (default: WAYPOINT)

  // Actions
  setMode: (mode: 'SELECT' | 'NODE' | 'EDGE') => void;
  setActiveNodeType: (type: NodeType) => void;
  
  // Selection
  selectItem: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  
  // CRUD - Nodes
  addNode: (x: number, y: number) => void;
  updateNode: (id: string, updates: Partial<GraphNode>) => void;
  deleteNode: (id: string) => void;
  
  // CRUD - Edges
  addEdge: (fromId: string, toId: string) => void;
  deleteEdge: (id: string) => void;
  
  // Bulk
  loadGraph: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  clearGraph: () => void;

  // Aircraft State
  aircrafts: import('./types').Aircraft[];
  updateAircraft: (data: import('./types').Aircraft) => void;
  setAircrafts: (list: import('./types').Aircraft[]) => void;
  setMapMeta: (meta: import('./types').MapMeta) => void;
  setCorners: (corners: import('@/shared/realtime/api/map.schema').MapCorners) => void;
  setMapDimensions: (width: number, height: number) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  mapMeta: null,
  corners: null,
  mapWidth: 2000, // Default fallback
  mapHeight: 1500, // Default fallback
  selectedId: null,
  hoveredId: null,
  interactionMode: 'SELECT',
  activeNodeType: 'WAYPOINT',

  setMode: (mode) => set({ interactionMode: mode, selectedId: null }),
  setActiveNodeType: (type) => set({ activeNodeType: type }),
  
  selectItem: (id) => set({ selectedId: id }),
  setHovered: (id) => set({ hoveredId: id }),

  addNode: (x, y) => {
    const { activeNodeType } = get();
    const newNode: GraphNode = {
      id: `node-${Date.now()}`, // Simple ID generation
      x,
      y,
      type: activeNodeType,
      label: `${activeNodeType}-${get().nodes.length + 1}`
    };
    
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    console.log(`[Store] Node Added: ${newNode.id} at (${x.toFixed(2)}, ${y.toFixed(2)})`);
  },

  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n))
  })),

  deleteNode: (id) => set((state) => ({
    // Remove node AND any connected edges
    nodes: state.nodes.filter((n) => n.id !== id),
    edges: state.edges.filter((e) => e.fromId !== id && e.toId !== id),
    selectedId: state.selectedId === id ? null : state.selectedId
  })),

  addEdge: (fromId, toId) => {
    if (fromId === toId) return; // No self-loops
    
    // Check if edge already exists
    const exists = get().edges.some(
      (e) => (e.fromId === fromId && e.toId === toId) || (e.bidirectional && e.fromId === toId && e.toId === fromId)
    );
    if (exists) return;

    const fromNode = get().nodes.find(n => n.id === fromId);
    const toNode = get().nodes.find(n => n.id === toId);
    
    if(!fromNode || !toNode) return;

    // Calculate Euclidean distance as initial cost
    const dx = fromNode.x - toNode.x;
    const dy = fromNode.y - toNode.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    const newEdge: GraphEdge = {
        id: `edge-${Date.now()}`,
        fromId,
        toId,
        bidirectional: true,
        cost: Number(dist.toFixed(2))
    };

    set((state) => ({ edges: [...state.edges, newEdge] }));
    console.log(`[Store] Edge Added: ${fromId} <-> ${toId}`);
  },

  deleteEdge: (id) => set((state) => ({
    edges: state.edges.filter((e) => e.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId
  })),

  loadGraph: (nodes, edges) => set({ nodes, edges }),
  clearGraph: () => set({ nodes: [], edges: [], selectedId: null }),

  // --- Aircraft State Actions ---
  aircrafts: [],
  updateAircraft: (data) => set((state) => {
      // console.log("[Store] Updating Aircraft:", data.id); // DEBUG LOG (Optional, maybe too noisy)
      const exists = state.aircrafts.find(a => a.id === data.id);
      if (exists) {
          return {
              aircrafts: state.aircrafts.map(a => a.id === data.id ? { ...a, ...data } : a)
          };
      } else {
          return {
              aircrafts: [...state.aircrafts, data]
          };
      }
  }),
  setAircrafts: (list) => set({ aircrafts: list }),
  setMapMeta: (meta) => set({ mapMeta: meta }),
  setCorners: (corners) => set({ corners: corners }),
  setMapDimensions: (width, height) => set({ mapWidth: width, mapHeight: height }),
}));
