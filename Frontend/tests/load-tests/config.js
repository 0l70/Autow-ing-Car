// 공통 설정 파일
export const BASE_URL = 'https://autowingcar.o-r.kr:8443';
export const WS_URL = 'wss://autowingcar.o-r.kr:8443/ws-server/websocket';

// 테스트용 계정 (실제 테스트 시 유효한 계정으로 변경 필요)
export const TEST_USERS = {
    PILOT: {
        email: 'pilot@atc.com', // TODO: 실제 DB에 존재하는 파일럿 계정
        password: '1234'
    },
    ADMIN: {
        email: 'atc@atc.com', // TODO: 실제 DB에 존재하는 관제사 계정
        password: '1234'
    }
};

// 임계치 설정 (Thresholds)
export const THRESHOLDS = {
    http_req_duration: ['p(95)<500'], // 95%의 요청이 500ms 이내
    http_req_failed: ['rate<0.01'],   // 에러율 1% 미만
};
