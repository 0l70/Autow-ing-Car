/*
 * steer_servo.c
 *
 *  Created on: Jan 28, 2026
 *      Author: SSAFY
 */


#include "steer_servo.h"

static uint32_t TIM_GetPeriodUs(TIM_HandleTypeDef *htim)
{
	uint32_t pclk;
	if (htim->Instance == TIM1)
	{
		// APB2 timers
		pclk = HAL_RCC_GetPCLK2Freq();
		if ((RCC->CFGR & RCC_CFGR_PPRE2) != RCC_CFGR_PPRE2_DIV1) pclk *= 2;
	}
	else
	{
		// APB1 timers
		pclk = HAL_RCC_GetPCLK1Freq();
		if ((RCC->CFGR & RCC_CFGR_PPRE1) != RCC_CFGR_PPRE1_DIV1) pclk *= 2;
	}

	uint32_t psc = htim->Instance->PSC;
	uint32_t arr = htim->Instance->ARR;

	uint32_t tick_hz = pclk / (psc + 1);

	uint32_t period_us = (uint32_t)((uint64_t)(arr + 1) * 1000000ULL / tick_hz);
	return period_us;
}

static void Steer_SetPulseUs(uint16_t pulse_us)
{
	uint32_t period_us = TIM_GetPeriodUs(&htim3);
	if (period_us == 0) return;

	uint32_t arr = __HAL_TIM_GET_AUTORELOAD(&htim3);
	uint32_t ccr = (uint32_t)((uint64_t)(arr + 1) * pulse_us / period_us);

	__HAL_TIM_SET_COMPARE(&htim3, TIM_CHANNEL_3, ccr);
}

void Steer_Init(void)
{
	HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_3);

	Steer_SetPulseUs(1500);
}

void Steer_SetPercent(int8_t steer_percent)
{
	if (steer_percent > 100)
		steer_percent = 100;
	if (steer_percent < -100)
		steer_percent = -100;

	// -100 => 1000us, 0 => 1500us, +100 => 2000us
	int32_t pulse = 1500 + (int32_t)steer_percent * 5;

	if (pulse < 1000)
		pulse = 1000;
	if (pulse > 2000)
		pulse = 2000;

	Steer_SetPulseUs((uint16_t)pulse);
}
