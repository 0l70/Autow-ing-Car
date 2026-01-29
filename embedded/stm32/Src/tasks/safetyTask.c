/*
 * safetyTask.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */


#include "safetyTask.h"

#include "cmsis_os.h"
#include <stdio.h>

#include "app_shared.h"

#include "motor.h"
#include "steer_servo.h"
#include "dock.h"

#ifndef SAFETY_PERIOD_MS
#define SAFETY_PERIOD_MS 10u
#endif

static void Safety_ApplyHardStop(void)
{
    g_safe_stop = 1;

    g_out_speed = 0;
    g_out_steer = 0;

    DC_Motor_SetSpeedPercent(0);
    DC_Motor_Enable(false);

    Steer_SetPercent(0);
    Dock_SafePose();
}

static void Safety_ClearStop(void)
{
    g_safe_stop = 0;
}

void AppSafetyTask(void *argument)
{
    (void)argument;

    uint8_t last_state = 0xFF;

    for (;;)
    {
        uint32_t now = osKernelGetTickCount();

        // 0=OK, 1=TIMEOUT, 2=ESTOP, 3=DISABLED
        uint8_t state = 0;

        // DISABLED 우선
        if ((g_rx_flags & FLAG_ENABLE) == 0) state = 3;
        else if (estop_latched) state = 2;
        else if ((now - last_cmd_tick) > CMD_FRESH_MS) state = 1;
        else state = 0;

        if (state != last_state)
        {
            last_state = state;

            printf("[Safety] state=%u flags=0x%02X last=%lu now=%lu\r\n",
                   (unsigned)state, (unsigned)g_rx_flags,
                   (unsigned long)last_cmd_tick, (unsigned long)now);

            if (state == 0)
            	printf("[Safety] OK\r\n");
            else if (state == 1)
            	printf("[Safety] TIMEOUT -> HARD STOP\r\n");
            else if (state == 2)
            	printf("[Safety] ESTOP -> HARD STOP\r\n");
            else
            	printf("[Safety] DISABLED -> SAFE\r\n");
        }

        if (state != 0) Safety_ApplyHardStop();
        else            Safety_ClearStop();

        osDelay(SAFETY_PERIOD_MS);
    }
}
