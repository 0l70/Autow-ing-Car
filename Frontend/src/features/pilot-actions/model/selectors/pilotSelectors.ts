import type { Aircraft } from '@/entities/map/model/types';
import type { FlightInfo } from '@/features/dashboard/model/dashboardTypes';
import type { MoveState, ConnectionState } from '../pilot.types';

/**
 * 비활성 차량 상태 목록
 * [수정] WAITING_FOR_RETURN, RETURNING 등도 모니터링해야 하므로 제외.
 * 오직 IDLE이거나, 할당 정보가 없을 때만 비활성으로 간주하도록 변경 검토.
 * 일단 리스트에서 IDLE만 남김.
 */
const INACTIVE_STATUSES = ['IDLE'] as const;

/**
 * 활성 차량 ID 계산
 * - 할당된 차량이 활성 상태면 해당 ID 반환
 * - 아니면 fallback ID 중 활성 상태인 것 반환
 */
export function selectActiveCarId(
  aircrafts: Aircraft[],
  flightInfo: FlightInfo | null,
  initialCarId?: string,
  fetchedCarId?: string
): string | undefined {
  const assignedCar = flightInfo?.assignedCarId
    ? aircrafts.find((a) => a.id === flightInfo.assignedCarId)
    : null;

  // 할당된 차량이 활성 상태인 경우
  if (assignedCar && !INACTIVE_STATUSES.includes(assignedCar.status as any)) {
    return assignedCar.id;
  }

  // Fallback: initialCarId 또는 fetchedCarId 중 활성 상태인 것
  const fallbackId = initialCarId || fetchedCarId;
  if (fallbackId) {
    const fallbackCar = aircrafts.find(
      (a) => a.id === fallbackId && !INACTIVE_STATUSES.includes(a.status as any)
    );
    if (fallbackCar) return fallbackId;
  }

  return undefined;
}

/**
 * 버튼 활성화 상태 계산
 */
export function selectButtonStates(moveState: MoveState, connState: ConnectionState) {
  return {
    isEmergencyStopEnabled: 
      connState === 'connected' && 
      (moveState === 'pushback' || moveState === 'moving'),
    isResumeEnabled: moveState === 'paused',
  };
}

/**
 * Socket Car ID 계산 (항상 subscribe, IDLE도 포함)
 */
export function selectSocketCarId(
  flightInfo: FlightInfo | null,
  fetchedCarId?: string,
  initialCarId?: string
): string | undefined {
  return flightInfo?.assignedCarId || fetchedCarId || initialCarId;
}
