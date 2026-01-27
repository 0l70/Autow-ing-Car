package com.project.domain.common;

/**
 * 차량 상태
 * 연결 전 움직임 과 연결 후의 움직임은 다르다
 * 
 */
public enum CarStatus {
   IDLE, // 어느것도 대기 가능
   MOVING_TO_LOAD, // 항공기를 향해 이동 중
   LOADING, // 도킹 시도 중
   TOWING, // 도킹 중
   UNLOADING, // 도킹 해재 중
   MOVING_TO_IDLE, // 베이스로 돌아감
   STOP, // 정지
   ERROR // 에러
}