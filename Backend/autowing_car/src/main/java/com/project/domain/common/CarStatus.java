package com.project.domain.common;

public enum CarStatus {
   IDLE, // 대기 중 (명령 가능)
   BUSY, // 작업 중 (연결 중 등)
   MOVING, // 이동 중 (단순 이동)
   TOWING, // 토잉 중 (비행기 끌고 있음)
   STOP, // 정지 (긴급 정지 등)
   ERROR, // 고장/에러
}