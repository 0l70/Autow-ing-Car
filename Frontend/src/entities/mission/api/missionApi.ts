import { apiClient } from '@/shared/api/apiClient';
import { MissionInfo } from '../model/store';

export const missionApi = {
    getActiveMissions: async (): Promise<Record<string, MissionInfo>> => {
        return apiClient.request<Record<string, MissionInfo>>('/api/mission');
    }
};
