/*
 * dockTask.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */


#include "dockTask.h"

#include <stdint.h>

#include "cmsis_os.h"
#include "app_shared.h"
#include "dock.h"

static uint8_t dock_abort_check(void)
{
  if (g_safe_stop) return 1;

  uint8_t f = g_rx_flags;

  if ((f & FLAG_ENABLE) == 0) return 1;
  if (f & FLAG_ESTOP) return 1;

  uint32_t now = osKernelGetTickCount();
  if ((now - last_cmd_tick) > CMD_FRESH_MS) return 1;

  return 0;
}

void AppDockTask(void *argument)
{
  (void)argument;

  Dock_InitPwm();
  Dock_SetAbortChecker(dock_abort_check);
  Dock_SafePose();

  uint8_t prev_start = 0;
  uint8_t prev_abort = 0;
  uint8_t was_safe = 1;

  for (;;)
  {
    uint8_t f = g_rx_flags;
    uint8_t start = (f & FLAG_DOCK_START) ? 1 : 0;
    uint8_t abort = (f & FLAG_DOCK_ABORT) ? 1 : 0;

    if (g_safe_stop) {
      Dock_SafePose();
      was_safe = 1;
      osDelay(10);
      continue;
    }

    if (was_safe) {
      was_safe = 0;
      if (start && !abort) {
        Dock_RunDockSequence();
      }
    }

    if (!prev_abort && abort) {
      Dock_RunReleaseSequence();
    }

    if (!prev_start && start && !abort) {
      Dock_RunDockSequence();
    }

    prev_start = start;
    prev_abort = abort;

    static uint32_t t=0;
    uint32_t now=osKernelGetTickCount();
    if(now-t > 1000)
    {
    	t=now;
    }

    osDelay(10);
  }
}

