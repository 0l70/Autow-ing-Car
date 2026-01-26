// Pilot Dashboard Mock Data (Content in English, Comments in Korean)

// 시스템 로그 데이터 (영어)
export const INITIAL_LOGS = [
    { id: 1, type: 'info', message: 'TWR: Takeoff Clearance Granted (Runway 09R)', timestamp: '10:30:15' },
    { id: 2, type: 'success', message: 'SYS: Tug Connected Successfully (Tug-04)', timestamp: '10:28:45' },
    { id: 3, type: 'warning', message: 'WARN: High Crosswind Detected (15kt)', timestamp: '10:25:20' },
    { id: 4, type: 'info', message: 'SYS: Path Data Received', timestamp: '10:24:10' },
];

// 차량 상태 데이터
export const VEHICLE_STATUS = {
    id: 'TUG-004',
    battery: 85,
    signal: 'Excellent (4G)',
    mode: 'Manual' as const, // 'Manual' | 'Auto'
};

// 운항 데이터
export const NAVIGATION_DATA = {
    groundSpeed: 0, // knots
    heading: 120, // degrees
    destination: 'Runway 09R',
    targetGate: 'G-12',
    eta: '04:20'
};
