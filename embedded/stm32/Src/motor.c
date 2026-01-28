/*
 * motor.c
 *
 *  Created on: Jan 28, 2026
 *      Author: SSAFY
 */


#include "motor.h"

// 내부: TIM2_CH1 duty(0~100%) 설정
static void DC_Motor_SetDuty(uint8_t duty)
{
    if (duty > 100) duty = 100;

    uint32_t arr = __HAL_TIM_GET_AUTORELOAD(&htim2);
    uint32_t ccr = (arr + 1) * duty / 100;

    __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, ccr);
}

void DC_Motor_Enable(bool en)
{
    // CubeMX 매크로 사용
    HAL_GPIO_WritePin(DC_STBY_GPIO_Port, DC_STBY_Pin, en ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void DC_Motor_Coast(void)
{
    HAL_GPIO_WritePin(DC_AIN1_GPIO_Port, DC_AIN1_Pin, GPIO_PIN_RESET);
    HAL_GPIO_WritePin(DC_AIN2_GPIO_Port, DC_AIN2_Pin, GPIO_PIN_RESET);
}

void DC_Motor_Brake(void)
{
    HAL_GPIO_WritePin(DC_AIN1_GPIO_Port, DC_AIN1_Pin, GPIO_PIN_SET);
    HAL_GPIO_WritePin(DC_AIN2_GPIO_Port, DC_AIN2_Pin, GPIO_PIN_SET);
}

void DC_Motor_Init(void)
{
    // PWM start (PA0 = TIM2_CH1)
    HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1);
    HAL_GPIO_WritePin(DC_STBY_GPIO_Port, DC_STBY_Pin, GPIO_PIN_SET);
    // 안전 기본값
    DC_Motor_SetDuty(0);
    DC_Motor_Coast();
    DC_Motor_Enable(false);
}

void DC_Motor_SetSpeedPercent(int8_t spd)
{
    if (spd > 100) spd = 100;
    if (spd < -100) spd = -100;

    // 0이면 정지 처리 (coast 기본)
    if (spd == 0)
    {
        DC_Motor_SetDuty(0);
        DC_Motor_Coast();
        // DC_Motor_Enable(false); // 완전 차단 원하면 켜
        return;
    }

    // enable
    DC_Motor_Enable(true);

    if (spd > 0)
    {
        // 정방향: AIN1=1, AIN2=0
        HAL_GPIO_WritePin(DC_AIN1_GPIO_Port, DC_AIN1_Pin, GPIO_PIN_SET);
        HAL_GPIO_WritePin(DC_AIN2_GPIO_Port, DC_AIN2_Pin, GPIO_PIN_RESET);
        DC_Motor_SetDuty((uint8_t)spd);
    }
    else
    {
        // 역방향: AIN1=0, AIN2=1
        HAL_GPIO_WritePin(DC_AIN1_GPIO_Port, DC_AIN1_Pin, GPIO_PIN_RESET);
        HAL_GPIO_WritePin(DC_AIN2_GPIO_Port, DC_AIN2_Pin, GPIO_PIN_SET);
        DC_Motor_SetDuty((uint8_t)(-spd));
    }
}
