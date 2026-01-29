/*
 * dockTask.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */


#include "tasks/dockTask.h"

#include <stdint.h>

#include "cmsis_os.h"
#include "app_shared.h"
#include "drivers/dock.h"

static uint8_t dock_abort_check(void)
{
  if (g_safe_stop) return 1;
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

  uint8_t prev_run_ok = 0;

  for (;;)
  {
    uint32_t now = osKernelGetTickCount();

    uint8_t f = g_rx_flags;
    uint8_t start = (f & FLAG_DOCK_START) ? 1 : 0;
    uint8_t abort = (f & FLAG_DOCK_ABORT) ? 1 : 0;

    uint8_t enabled = (f & FLAG_ENABLE) ? 1 : 0;
    uint8_t estop   = (f & FLAG_ESTOP) ? 1 : 0;
    uint8_t timeout = ((now - last_cmd_tick) > CMD_FRESH_MS) ? 1 : 0;

    uint8_t run_ok = (!g_safe_stop && enabled && !timeout && !estop) ? 1 : 0;

    if (g_safe_stop) {
      Dock_SafePose();
      was_safe = 1;
      prev_start = start;
      prev_abort = abort;
      prev_run_ok = 0;
      osDelay(10);
      continue;
    }

    if (prev_run_ok && !run_ok) {
      Dock_SafePose();   // clamp open
      prev_start = start;
      prev_abort = abort;
    }
    prev_run_ok = run_ok;

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

    osDelay(10);
  }
}


