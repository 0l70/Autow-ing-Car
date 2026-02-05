import { apiClient } from '@/shared/api/apiClient';
import { MissionInfo } from '../model/store';

export const missionApi = {
    getActiveMissions: async (): Promise<Record<string, MissionInfo>> => {
        // 백엔드 엔드포인트에 맞춰 수정 필요 (현재는 예시)
        return apiClient.request<Record<string, MissionInfo>>('/api/missions');
    }
};
