/*
 * appState.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */


#include "app_shared.h"

// RTOS object
osMessageQueueId_t cmdQueue = NULL;

// shared state
volatile uint32_t last_cmd_tick = 0;
volatile uint8_t  estop_latched = 0;
volatile uint8_t  g_safe_stop = 1;

volatile Cmd      g_latest_cmd = {0};

volatile int8_t   g_out_speed = 0;
volatile int8_t   g_out_steer = 0;

volatile uint8_t  g_rx_flags = 0;
