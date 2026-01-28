/*
 * steer_servo.c
 *
 *  Created on: Jan 28, 2026
 *      Author: SSAFY
 */


#include "steer_servo.h"

// 내부: TIM3 주기(us)를 ARR/PSC로부터 계산
static uint32_t TIM_GetPeriodUs(TIM_HandleTypeDef *htim)
{
    // 타이머 입력 클럭을 APB에서 계산하는 건 칩/설정 따라 달라서,
    // HAL helper로 pclk를 얻는게 제일 안전.
    // F1은 APB prescaler가 1이 아니면 timer clk = 2*PCLKx 규칙이 있어서
    // 여기서는 "HAL_RCC_GetPCLKxFreq + prescaler 보정"을 해줌.

    uint32_t pclk;
    if (htim->Instance == TIM1)
    {
        // APB2 timers
        pclk = HAL_RCC_GetPCLK2Freq();
        // APB2 prescaler 확인해서 timer clk 보정
        if ((RCC->CFGR & RCC_CFGR_PPRE2) != RCC_CFGR_PPRE2_DIV1) pclk *= 2;
    }
    else
    {
        // APB1 timers (TIM2/3/4...)
        pclk = HAL_RCC_GetPCLK1Freq();
        if ((RCC->CFGR & RCC_CFGR_PPRE1) != RCC_CFGR_PPRE1_DIV1) pclk *= 2;
    }

    uint32_t psc = htim->Instance->PSC; // 실제 레지스터 값
    uint32_t arr = htim->Instance->ARR;

    // timer tick freq = timer_clk / (PSC+1)
    uint32_t tick_hz = pclk / (psc + 1);

    // period seconds = (ARR+1)/tick_hz
    // period us = period seconds * 1e6
    uint32_t period_us = (uint32_t)((uint64_t)(arr + 1) * 1000000ULL / tick_hz);
    return period_us;
}

static void Steer_SetPulseUs(uint16_t pulse_us)
{
    uint32_t period_us = TIM_GetPeriodUs(&htim3);
    if (period_us == 0) return;

    // CCR = (ARR+1) * pulse_us / period_us
    uint32_t arr = __HAL_TIM_GET_AUTORELOAD(&htim3);
    uint32_t ccr = (uint32_t)((uint64_t)(arr + 1) * pulse_us / period_us);

    __HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_3, ccr);
}

void Steer_Init(void)
{
    HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_3);

    // 중립(1.5ms)
    Steer_SetPulseUs(1500);
}

void Steer_SetPercent(int8_t steer_percent)
{
    if (steer_percent > 100) steer_percent = 100;
    if (steer_percent < -100) steer_percent = -100;

    // -100 => 1000us, 0 => 1500us, +100 => 2000us
    int32_t pulse = 1500 + (int32_t)steer_percent * 5;

    // 서보 보호 클램프(필요하면 좁혀)
    if (pulse < 1000) pulse = 1000;
    if (pulse > 2000) pulse = 2000;

    Steer_SetPulseUs((uint16_t)pulse);
}
