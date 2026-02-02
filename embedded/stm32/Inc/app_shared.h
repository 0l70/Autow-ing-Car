/*
 * appState.h
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */

#ifndef INC_APPSTATE_H_
#define INC_APPSTATE_H_

#include <stdint.h>
#include "cmsis_os.h"
#include "cmd.h"

typedef struct {
  uint8_t  seq;
  uint8_t  flags;
  uint32_t last_rx_tick;
} CmdState;

// configs
#define CMD_FRESH_MS        200u
#define CONTROL_PERIOD_MS    20u

#define FLAG_ENABLE     (1u<<0)
#define FLAG_ESTOP      (1u<<1)
#define FLAG_DOCK_START (1u<<2)
#define FLAG_DOCK_ABORT (1u<<3)

#define UART_RX_FLAG    (1u<<0)
#define RXBUF_SIZE      256u


// RTOS object
extern osMessageQueueId_t cmdQueue;

// shared state
extern volatile uint32_t last_cmd_tick;
extern volatile uint8_t  estop_latched;
extern volatile uint8_t  g_safe_stop;

extern volatile Cmd      g_latest_cmd;

extern volatile int8_t   g_out_speed;
extern volatile int8_t   g_out_steer;

extern volatile uint8_t  g_rx_flags;

#endif /* INC_APPSTATE_H_ */
