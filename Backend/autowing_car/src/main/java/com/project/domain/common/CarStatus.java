package com.project.domain.common;

/**
 * 차량 상태
 * 연결 전 움직임 과 연결 후의 움직임은 다르다
 * 
 */
public enum CarStatus {
   IDLE, // 차고지 대기
   MOVING_TO_GATE, // 항공기(게이트)로 이동 중
   DOCKING, // 도킹 시도 중
   TOWING, // 토잉 중 (항공기 견인)
   UNDOCKING, // 도킹 해제 중
   WAITING_FOR_RETURN, // 도킹 해제 완료 후 복귀 대기
   RETURNING, // 차고지로 복귀 중
   STOP, // 비상 정지 / 일시 정지
   ERROR; // 에러

   public static CarStatus from(String status) {
      try {
         return CarStatus.valueOf(status.toUpperCase());
      } catch (Exception e) {
         return CarStatus.IDLE;
      }
   }
}