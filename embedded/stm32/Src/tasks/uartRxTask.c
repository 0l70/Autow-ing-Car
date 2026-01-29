/*
 * uartRxTask.c
 *
 *  Created on: Jan 29, 2026
 *      Author: SSAFY
 */


#include "uartRxTask.h"

#include <stdint.h>
#include <string.h>

#include "cmsis_os.h"
#include "usart.h"
#include "cmd.h"
#include "app_shared.h"

extern osThreadId_t UartRxTaskHandle;

// RX ring buffer
static uint8_t  s_rx_byte;
static uint8_t  s_rxbuf[RXBUF_SIZE];
static volatile uint16_t s_rx_head = 0;
static volatile uint16_t s_rx_tail = 0;

static inline void rxbuf_push(uint8_t b)
{
	uint16_t next = (uint16_t)((s_rx_head + 1u) % RXBUF_SIZE);
	if (next == s_rx_tail) {
		// overflow: oldest drop
		s_rx_tail = (uint16_t)((s_rx_tail + 1u) % RXBUF_SIZE);
	}
	s_rxbuf[s_rx_head] = b;
	s_rx_head = next;
}

static inline int rxbuf_pop(uint8_t *out)
{
	if (s_rx_tail == s_rx_head) return 0;
	*out = s_rxbuf[s_rx_tail];
	s_rx_tail = (uint16_t)((s_rx_tail + 1u) % RXBUF_SIZE);
	return 1;
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
	if (huart->Instance == USART2) {
		rxbuf_push(s_rx_byte);

		if (UartRxTaskHandle != NULL) {
				osThreadFlagsSet(UartRxTaskHandle, UART_RX_FLAG);
		}

		(void)HAL_UART_Receive_IT(huart, &s_rx_byte, 1);
	}
}

void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)
{
	if (huart->Instance == USART2) {
		(void)HAL_UART_AbortReceive_IT(huart);
		(void)HAL_UART_Receive_IT(huart, &s_rx_byte, 1);
	}
}

static void queue_put_latest(const Cmd* cmd)
{
	osStatus_t st = osMessageQueuePut(cmdQueue, cmd, 0, 0);
	if (st == osErrorResource) {
		Cmd dummy;
		(void)osMessageQueueGet(cmdQueue, &dummy, NULL, 0);
		(void)osMessageQueuePut(cmdQueue, cmd, 0, 0);
	}
}

void AppUartRxTask(void *argument)
{
	(void)argument;

	(void)HAL_UART_Receive_IT(&huart2, &s_rx_byte, 1);

	uint8_t pkt[PKT_LEN];
	uint8_t idx = 0;

	static uint8_t s_last_rx_seq = 0xFF;

	for (;;)
	{
			(void)osThreadFlagsWait(UART_RX_FLAG, osFlagsWaitAny, osWaitForever);

			uint8_t b;
			while (rxbuf_pop(&b))
			{
				if (idx == 0) {
					if (b == PKT_MAGIC0) {
						pkt[idx++] = b;
					}
					continue;
				}
				if (idx == 1) {
					if (b == PKT_MAGIC1) {
						pkt[idx++] = b;
					} else {
						idx = 0;
						if (b == PKT_MAGIC0) {
							pkt[idx++] = b;
						}
					}
					continue;
				}

				pkt[idx++] = b;

				if (idx >= PKT_LEN)
				{
					// 8바이트 모이면 패킷 검증
					if (pkt_validate(pkt))
					{
						uint32_t now = osKernelGetTickCount();

						Cmd cmd;
						pkt_to_cmd(pkt, &cmd, now);

						// 공용 상태 갱신
						g_latest_cmd  = cmd;
						g_rx_flags    = cmd.flags;
						last_cmd_tick = now;

						// ESTOP 확인
						if (cmd.flags & FLAG_ESTOP) {
							estop_latched = 1;
						}

						if (cmd.seq != s_last_rx_seq) {
							s_last_rx_seq = cmd.seq;
						}

						queue_put_latest(&cmd);
					}

						idx = 0;
				}
		}
	}
}
