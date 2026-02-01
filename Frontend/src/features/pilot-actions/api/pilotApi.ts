export interface TowingCarStatusDTO {
    code: string | null;
    status: string; // 'IDLE' | 'MOVING_TO_LOAD' | 'LOADING' | 'CONNECTED' etc
    battery: number;
    posX: number;
    posY: number;
    heading: number;
    velocity: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const pilotApi = {
    async getTowingCarStatus(token: string): Promise<TowingCarStatusDTO> {
        const response = await fetch(`${API_BASE_URL}/api/towing-car/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch car status: ${response.status}`);
        }

        return response.json();
    }
};
