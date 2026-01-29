/*
 * steer_servo.h
 *
 *  Created on: Jan 28, 2026
 *      Author: SSAFY
 */

#ifndef INC_STEER_SERVO_H_
#define INC_STEER_SERVO_H_

#include "main.h"
#include <stdint.h>

// TIM3 CH3 = PB0 (STEER)
extern TIM_HandleTypeDef htim3;

void Steer_Init(void);
void Steer_SetPercent(int8_t steer_percent);


#endif /* INC_STEER_SERVO_H_ */
