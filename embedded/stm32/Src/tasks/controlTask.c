/*
 * controlTask.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */

#include "tasks/controlTask.h"
#include "cmd.h"
#include "drivers/motor.h"
#include "app_shared.h"


/*
 * controlTask.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */

#include "tasks/controlTask.h"
#include "cmd.h"
#include "drivers/motor.h"
#include "app_shared.h"

#include <stdio.h>

void AppControlTask(void *argument)
{
    static uint8_t inited       = 0;
    static uint8_t last_act_seq = 0xFF;

    static uint8_t  last_rx_seq = 0xFF;
    static uint32_t last_ctrl_log_tick = 0;

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

            printf("[Control] init done\r\n");
        }

        // cmd 갱신
        if (osMessageQueueGet(cmdQueue, &cmd, NULL, 0) == osOK) {
            g_latest_cmd = cmd;

            if (g_latest_cmd.seq != last_rx_seq) {
                last_rx_seq = g_latest_cmd.seq;
                printf("[RX] tick=%lu seq=%u sp=%d st=%d flags=0x%02X last_cmd_tick=%lu\r\n",
                       (unsigned long)now,
                       (unsigned)g_latest_cmd.seq,
                       (int)g_latest_cmd.speed,
                       (int)g_latest_cmd.steer,
                       (unsigned)g_rx_flags,
                       (unsigned long)last_cmd_tick);
            }
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

                printf("[ACT] tick=%lu seq=%u out(sp=%d st=%d) flags=0x%02X\r\n",
                       (unsigned long)now,
                       (unsigned)g_latest_cmd.seq,
                       (int)out_speed,
                       (int)out_steer,
                       (unsigned)g_rx_flags);
            }

            DC_Motor_Enable(true);
            DC_Motor_SetSpeedPercent(out_speed);
            Steer_SetPercent(out_steer);
        }

        g_out_speed = out_speed;
        g_out_steer = out_steer;

        if ((now - last_ctrl_log_tick) >= 200) {
            last_ctrl_log_tick = now;
            printf("[Control] tick=%lu ok=%u en=%u to=%u safe=%u estop=%u flags=0x%02X last=%lu now=%lu out(sp=%d st=%d)\r\n",
                   (unsigned long)now,
                   (unsigned)run_ok,
                   (unsigned)enabled,
                   (unsigned)timeout,
                   (unsigned)g_safe_stop,
                   (unsigned)estop_latched,
                   (unsigned)g_rx_flags,
                   (unsigned long)last_cmd_tick,
                   (unsigned long)now,
                   (int)g_out_speed,
                   (int)g_out_steer);
        }

        osDelay(CONTROL_PERIOD_MS);
    }
}
