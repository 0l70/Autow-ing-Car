/*
 * dock.h
 *
 *  Created on: Jan 27, 2026
 *      Author: SSAFY
 */

#ifndef INC_DOCK_H_
#define INC_DOCK_H_

#include <stdint.h>
#include "main.h"
#include "cmsis_os2.h"

// TIM3_CH1: Lift(위아래), TIM3_CH2: Clamp(집게) 가정
// (PA6=CH1, PA7=CH2 추천)
void Dock_InitPwm(void);
void Dock_SafePose(void);

// 도킹 시퀀스: 아래 -> 닫기 -> 위
void Dock_RunDockSequence(void);

// 해제 시퀀스: 아래 -> 열기 -> 위
void Dock_RunReleaseSequence(void);

// 외부에서 abort 조건을 체크할 수 있게 콜백 형태로 분리
// freertos 쪽에서 g_safe_stop / flags 기반으로 넣어줌
typedef uint8_t (*dock_abort_fn_t)(void);
void Dock_SetAbortChecker(dock_abort_fn_t fn);


#endif /* INC_DOCK_H_ */
