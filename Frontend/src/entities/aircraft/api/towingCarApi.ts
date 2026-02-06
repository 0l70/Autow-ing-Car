import { apiClient } from '@/shared/api/apiClient';
import { Aircraft } from '@/entities/map/model/types';

interface TowingCarStatusResponse {
    code: string;
    posX: number;
    posY: number;
    heading: number;
    velocity: number;
    battery: number;
    status: string;
}

export const towingCarApi = {
    getAllTowingCars: async (): Promise<Aircraft[]> => {
        const rawData = await apiClient.request<TowingCarStatusResponse[]>('/api/towing-car');
        
        // Map backend response to frontend Aircraft type
        return rawData.map((car) => ({
            id: car.code,
            callsign: car.code,
            type: 'TUG' as const,
            position: {
                x: car.posX ?? 0,
                y: car.posY ?? 0,
                r: (car.heading ?? 0) * (Math.PI / 180)  // Convert degrees to radians
            },
            status: (car.status || 'IDLE') as Aircraft['status'],
            battery: car.battery ?? 0,
            speed: car.velocity ?? 0,
            isLoaded: car.status === 'TOWING' || car.status === 'UNDOCKING'
        }));
    }
};
