package com.project.domain.common;

// 2. 차량/미션/노드/엣지 상태
public enum EntityStatus {
    // 차량/노드/엣지 공용
    AVAILABLE, BLOCKED, IDLE, TOWING,
    // 미션 전용
    WAITING, RUNNING, COMPLETED, CANCELLED
}
