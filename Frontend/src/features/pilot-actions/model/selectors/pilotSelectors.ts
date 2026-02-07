import type { Aircraft } from '@/entities/map/model/types';
import type { FlightInfo } from '@/features/dashboard/model/dashboardTypes';
import type { MoveState, ConnectionState } from '../pilot.types';

/**
 * 비활성 차량 상태 목록
 */
const INACTIVE_STATUSES = ['IDLE', 'UNDOCKING', 'RETURNING', 'WAITING_FOR_RETURN'] as const;

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
 * Socket Car ID 계산 (구독 대상 ID)
 * - UNDOCKING 상태이거나 미션이 COMPLETED되면 undefined 반환하여 구독 해제
 */
export function selectSocketCarId(
  flightInfo: FlightInfo | null,
  aircrafts: Aircraft[],
  activeMissions: Record<string, any>,
  fetchedCarId?: string,
  initialCarId?: string
): string | undefined {
  const targetId = flightInfo?.assignedCarId || fetchedCarId || initialCarId;
  
  if (!targetId) return undefined;

  // 1. Check Vehicle Status (UNDOCKING -> Unsubscribe)
  const car = aircrafts.find(a => a.id === targetId);
  if (car?.status === 'UNDOCKING') {
    return undefined;
  }

  // 2. Check Mission Status (COMPLETED -> Unsubscribe)
  const mission = activeMissions[targetId];
  if (mission?.status === 'COMPLETED') {
    return undefined;
  }

  return targetId;
}
