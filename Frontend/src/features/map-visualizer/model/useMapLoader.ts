import { useEffect } from 'react';
import { useGraphStore } from '@/entities/map/model/store';
import { MOCK_NODES, MOCK_EDGES } from '@/entities/map/lib/mockData';

/**
 * Loads the initial graph data (Nodes & Edges) into the store.
 * This logic was previously in DashboardPage.tsx.
 * Used by both PilotPage and ControllerPage.
 */
export function useMapLoader() {
    const { loadGraph, corners } = useGraphStore();

    useEffect(() => {
        // Only load mock graph if no real map data is present yet
        // In a real app, this might fetch from an API
        if (!corners) {
            // [Fix] Do NOT load static mock data. Wait for backend WebSocket data.
            // loadGraph(MOCK_NODES, MOCK_EDGES);
        }
    }, [loadGraph, corners]);
}
