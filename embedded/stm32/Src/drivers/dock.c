/*
 * dock.c
 *
 *  Created on: Jan 27, 2026
 *      Author: SSAFY
 */

#include "dock.h"
#include "cmsis_os2.h"

extern TIM_HandleTypeDef htim3;

static dock_abort_fn_t s_abort_fn = 0;

#define LIFT_UP_US       1500 // 2000 // to defalut pose(up)
#define LIFT_DOWN_US     1500 // 1300 // down
#define CLAMP_OPEN_US    1200 // default pose(open)
#define CLAMP_CLOSE_US   1800 // close

static inline void servo_set_us(uint32_t channel, uint16_t us)
{
  __HAL_TIM_SET_COMPARE(&htim3, channel, us);
}

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

static void servo_ramp_us(uint32_t channel, uint16_t from_us, uint16_t to_us,
                          uint16_t step_us, uint16_t step_delay_ms)
{
  if (step_us == 0) step_us = 1;

  int32_t cur = from_us;
  int32_t target = to_us;
  int32_t step = (target >= cur) ? (int32_t)step_us : -(int32_t)step_us;

  while (cur != target) {
    cur += step;

    if ((step > 0 && cur > target) || (step < 0 && cur < target)) cur = target;

    __HAL_TIM_SET_COMPARE(&htim3, channel, (uint16_t)cur);

    if (step_delay_ms) osDelay(step_delay_ms);
  }
}

static void lift_move_slow(uint16_t target_us)
{
  servo_ramp_us(TIM_CHANNEL_1, g_lift_us, target_us, 5, 10);
  g_lift_us = target_us;
}

static void clamp_move_slow(uint16_t target_us)
{
  servo_ramp_us(TIM_CHANNEL_2, g_clamp_us, target_us, 5, 10);
  g_clamp_us = target_us;
}

void Dock_SafePose(void)
{
	lift_move_slow(LIFT_UP_US);
	clamp_move_slow(CLAMP_OPEN_US);
}

void Dock_RunDockSequence(void)
{
  if (should_abort()) return;
  lift_move_slow(LIFT_DOWN_US);
  osDelay(1000);

  if (should_abort()) return;
  clamp_move_slow(CLAMP_CLOSE_US);
  osDelay(1000);

  if (should_abort()) return;
  lift_move_slow(LIFT_UP_US);
  osDelay(1000);
}

void Dock_RunReleaseSequence(void)
{
  if (should_abort()) return;
  lift_move_slow(LIFT_DOWN_US);
  osDelay(1000);

  if (should_abort()) return;
  clamp_move_slow(CLAMP_OPEN_US);
  osDelay(1000);

  if (should_abort()) return;
  lift_move_slow(LIFT_UP_US);
  osDelay(1000);
}
