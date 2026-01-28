/**
 * WebSocket Topic Definitions
 * Centralized configuration for all STOMP topics used in the application.
 */
export const WS_TOPICS = {
    /**
     * Car Telemetry Monitoring
     * @param carId - Specific car ID or '*' for all cars
     */
    MONITORING: (carId: string = '*') => `/topic/towingcar/${carId}`,

    /**
     * System Map Information
     * Broadcasts map metadata, corners, and node graph.
     */
    MAP_INFO: '/topic/sys/map/info',

    /**
     * Application Responses (Legacy/Generic)
     */
    APP_RESPONSES: '/topic/app/responses',

    /**
     * Mission Updates
     */
    MISSION_UPDATES: '/topic/mission/updates',
} as const;
