import { apiClient } from '@/shared/api/apiClient';
import { FlightInfo } from '@/features/dashboard/model/dashboardTypes';

export const flightApi = {
    getFlightInfo: async (): Promise<FlightInfo> => {
        // 기장 전용 비행 정보 조회 (백엔드 로그 기준 /topic/flight-info 에 대응하는 REST API)
        return apiClient.request<FlightInfo>('/api/flight/info');
    }
};
