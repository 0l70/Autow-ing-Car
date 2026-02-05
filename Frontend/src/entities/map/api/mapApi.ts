import { apiClient } from '@/shared/api/apiClient';

export interface MapInfoResponse {
    nodes: any[];
    edges: any[];
    width: number;
    height: number;
    imagePath: string;
    resolution: number;
    originX: number;
    originY: number;
    corners: any;
}

export const mapApi = {
    getMapInfo: async (): Promise<MapInfoResponse> => {
        return apiClient.request<MapInfoResponse>('/api/map/info');
    }
};
