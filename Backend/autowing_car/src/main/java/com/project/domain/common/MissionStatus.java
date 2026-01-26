package com.project.domain.common;

public enum MissionStatus {
    WAITING,    // 관제 승인 대기 (미션 생성 직후)
    RUNNING,    // 승인 완료 및 운송 중
    PAUSED,     // 기장/관제사에 의한 일시 정지
    COMPLETED,  // 운송 완료
    REJECTED    // 관제사 반려
}