/*
 * motor.h
 *
 *  Created on: Jan 28, 2026
 *      Author: SSAFY
 */

#ifndef INC_MOTOR_H_
#define INC_MOTOR_H_

#include "main.h"
#include <stdint.h>
#include <stdbool.h>

// TIM2 CH1 = PA0 (PWMA)
extern TIM_HandleTypeDef htim2;

void DC_Motor_Init(void);
void DC_Motor_Enable(bool en);                 // STBY 제어
void DC_Motor_SetSpeedPercent(int8_t spd);     // -100 ~ +100
void DC_Motor_Coast(void);                     // AIN1=0, AIN2=0
void DC_Motor_Brake(void);                     // AIN1=1, AIN2=1


#endif /* INC_MOTOR_H_ */
