import { apiClient } from '@/shared/api/apiClient';
import { Aircraft } from '@/entities/map/model/types';

export const towingCarApi = {
    getAllTowingCars: async (): Promise<Aircraft[]> => {
        // 백엔드 엔드포인트에 맞춰 수정 필요
        return apiClient.request<Aircraft[]>('/api/towing-cars');
    }
};
