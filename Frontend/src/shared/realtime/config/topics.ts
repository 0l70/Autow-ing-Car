/**
 * WebSocket Topic Definitions
 * 어플리케이션 전체에서 사용하는 STOMP Topic/Destination 설정입니다.
 */
export const WS_TOPICS = {
  /**
   * [수신] 차량 텔레메트리 모니터링
   * - 관제사(ATC): carId='*' 사용하여 전체 차량 수신
   * - 기장(Pilot): carId='CAR_XXX' 사용하여 내 차량만 수신
   */
  MONITORING: (carId: string = "*") => `/topic/towingcar/${carId}`,

  /**
   * [수신] 시스템 지도 정보
   * Map Metadata, Corners, Node Graph 등을 수신합니다.
   */
  MAP_INFO: "/topic/sys/map/info",

  /**
   * [수신] 미션 업데이트 정보
   */
  MISSION_UPDATES: "/topic/mission/updates",

  /**
   * [수신] 관제사 요청 알림 (ATC)
   */
  CONTROLLER_REQUESTS: "/topic/controller/requests",

  /**
   * [수신] 공용 시스템 응답 (Legacy)
   * 추후 개인별 응답(/user/queue/responses)으로 대체될 수 있습니다.
   */
  APP_RESPONSES: "/topic/app/responses",

  /**
   * [수신] 개인별 응답 (Private)
   * 나에게만 오는 응답을 수신할 때 사용합니다.
   */
  PRIVATE_RESPONSES: "/user/queue/reply",

  /**
   * [수신] 기장 비행 스케줄 정보 (Private)
   * 기장 개인의 비행편 정보를 수신합니다.
   */
  PILOT_FLIGHT_INFO: "/user/queue/flight-info",

  /**
   * 🧑‍✈️ [기장 전용] 명령 전송 (Client -> Server)
   * 기장이 서버로 명령을 보낼 때 사용하는 경로입니다.
   */
  PILOT: {
    CONNECT: "/app/car/dispatch", // 연결 요청
    DISCONNECT: "/app/car/disconnect", // 해제 요청
    MOVE: "/app/car/move", // 이동 명령 (Pushback 등)
    MODE: "/app/car/mode", // 모드 변경 (Auto/Manual)
    EMERGENCY: "/app/car/emergency", // 비상 정지
    RESUME: "/app/car/resume", // [NEW] 작업 재개
    MISSION_REQUEST: "/app/mission/request", // 미션 요청 (기장용이지만 참고)
  },

  /**
   * 👨‍💼 [관제사 전용] 명령 전송 (Client -> Server)
   * 관제사가 서버로 명령을 보낼 때 사용하는 경로입니다.
   */
  ATC: {
    MISSION_DECIDE: "/app/mission/decide", // 미션 승인/반려
  },
} as const;
