/*
 * dock.c
 *
 *  Created on: Jan 27, 2026
 *      Author: SSAFY
 */

#include "drivers/dock.h"
#include "cmsis_os2.h"

extern TIM_HandleTypeDef htim3;

static dock_abort_fn_t s_abort_fn = 0;

#define LIFT_UP_US       1800 // up
#define LIFT_DOWN_US     1400 // down
#define CLAMP_OPEN_US    1100 // open
#define CLAMP_CLOSE_US   1600 // close

static inline uint8_t should_abort(void)
{
  return (s_abort_fn) ? s_abort_fn() : 0;
}

void Dock_SetAbortChecker(dock_abort_fn_t fn)
{
  s_abort_fn = fn;
}

void Dock_InitPwm(void)
{
  HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_1);
  HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_2);
}

static uint16_t g_lift_us  = 1500;
static uint16_t g_clamp_us = 1500;

static inline void lift_set(uint16_t us)
{
  __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_1, us);
  g_lift_us = us;
}

static inline void clamp_set(uint16_t us)
{
  __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_2, us);
  g_clamp_us = us;
}

void Dock_SafePose(void)
{
  lift_set(LIFT_UP_US);
  clamp_set(CLAMP_OPEN_US);
}

static void abort_to_safe(void)
{
  Dock_SafePose();
}

void Dock_RunDockSequence(void)
{
  if (should_abort()) { abort_to_safe(); return; }

  // 내려가기
  lift_set(LIFT_DOWN_US);
  osDelay(1000);

  // clamp 닫기
  clamp_set(CLAMP_CLOSE_US);
  osDelay(2000);

  // 올라오기
  lift_set(LIFT_UP_US);
  osDelay(1000);
}

void Dock_RunReleaseSequence(void)
{
  if (should_abort()) { abort_to_safe(); return; }

  // 내려가기
  lift_set(LIFT_DOWN_US);
  osDelay(1000);

  // clamp 열기
  clamp_set(CLAMP_OPEN_US);
  osDelay(2000);

  // 올라오기
  lift_set(LIFT_UP_US);
  osDelay(1000);
}
