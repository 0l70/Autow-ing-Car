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

// TIM3_CH1(PA6): Lift, TIM3_CH2(PA7): Clamp
void Dock_InitPwm(void);
void Dock_SafePose(void);

// 도킹 시작: 아래로 -> 닫고 -> 위로
void Dock_RunDockSequence(void);

// 도킹 해제: 아래로 -> 열고 -> 위로
void Dock_RunReleaseSequence(void);

typedef uint8_t (*dock_abort_fn_t)(void);

void Dock_SetAbortChecker(dock_abort_fn_t fn);


#endif /* INC_DOCK_H_ */
