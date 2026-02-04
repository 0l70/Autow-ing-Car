import { apiClient } from '@/shared/api/apiClient';

export interface TowingCarStatusDTO {
    code: string | null;
    status: string; // 'IDLE' | 'MOVING_TO_LOAD' | 'LOADING' | 'CONNECTED' etc
    battery: number;
    posX: number;
    posY: number;
    heading: number;
    velocity: number;
}

export const pilotApi = {
    async getTowingCarStatus(): Promise<TowingCarStatusDTO> {
        return apiClient.request<TowingCarStatusDTO>('/api/towing-car/status');
    }
};
