/*
 * controlTask.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */

#include "controlTask.h"
#include "cmd.h"
#include "motor.h"
#include "app_shared.h"


void AppControlTask(void *argument)
{
    static uint8_t inited       = 0;
    static uint8_t last_act_seq = 0xFF;

    Cmd cmd = (Cmd){0};

    for (;;)
    {
        uint32_t now = osKernelGetTickCount();

        if (!inited)
        {
            DC_Motor_Init();
            Steer_Init();

            DC_Motor_SetSpeedPercent(0);
            DC_Motor_Enable(false);
            Steer_SetPercent(0);

            inited = 1;
        }

        // cmd 갱신
        if (osMessageQueueGet(cmdQueue, &cmd, NULL, 0) == osOK) {
            g_latest_cmd = cmd;
        }

        const uint8_t enabled = (g_rx_flags & FLAG_ENABLE) ? 1 : 0;
        const uint8_t timeout = ((now - last_cmd_tick) > CMD_FRESH_MS) ? 1 : 0;
        const uint8_t run_ok  = (!g_safe_stop && enabled && !timeout && !estop_latched) ? 1 : 0;

        int8_t out_speed = 0;
        int8_t out_steer = 0;

        if (!run_ok)
        {
            out_speed = 0;
            out_steer = 0;

            DC_Motor_SetSpeedPercent(0);
            DC_Motor_Enable(false);
            Steer_SetPercent(0);
        }
        else
        {
            out_speed = g_latest_cmd.speed;
            out_steer = g_latest_cmd.steer;

            if (g_latest_cmd.seq != last_act_seq) {
                last_act_seq = g_latest_cmd.seq;
            }

            DC_Motor_Enable(true);
            DC_Motor_SetSpeedPercent(out_speed);
            Steer_SetPercent(out_steer);
        }

        g_out_speed = out_speed;
        g_out_steer = out_steer;

        osDelay(CONTROL_PERIOD_MS);
    }
}
