/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * File Name          : freertos.c
  * Description        : Code for freertos applications
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2026 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */

/* Includes ------------------------------------------------------------------*/
#include "FreeRTOS.h"
#include "task.h"
#include "main.h"
#include "cmsis_os.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <stdio.h>

#include "cmd.h"
#include "dock.h"
#include "motor.h"
#include "steer_servo.h"

/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */
extern UART_HandleTypeDef huart2;
extern TIM_HandleTypeDef htim3;

#define CMD_FRESH_MS       200u   // 명령 유효 시간(통일)
#define CONTROL_PERIOD_MS   20u   // 제어 주기(예: 50Hz)

#define FLAG_ENABLE     (1u<<0)
#define FLAG_ESTOP      (1u<<1)
#define FLAG_DOCK_START (1u<<2)
#define FLAG_DOCK_ABORT (1u<<3)

#define UART_RX_FLAG   (1U << 0)
#define RXBUF_SIZE     256

typedef struct {
  uint8_t seq;
  uint8_t flags;
  uint32_t last_rx_tick;
} CmdState;

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
/* USER CODE BEGIN Variables */
osMessageQueueId_t cmdQueue;

volatile uint32_t last_cmd_tick = 0;
volatile uint8_t  estop_latched = 0;
volatile uint8_t  g_safe_stop = 1;

// DockTask가 볼 최신 명령(큐는 ControlTask만 소비)
volatile Cmd g_latest_cmd = {0};

volatile int8_t g_out_speed = 0;
volatile int8_t g_out_steer = 0;


static uint8_t  s_rx_byte;
static uint8_t  s_rxbuf[RXBUF_SIZE];
static volatile uint16_t s_rx_head = 0;
static volatile uint16_t s_rx_tail = 0;

volatile uint8_t  g_rx_flags = 0;   // CommRx가 "마지막으로 받은" flags

/* USER CODE END Variables */
/* Definitions for ControlTask */
osThreadId_t ControlTaskHandle;
const osThreadAttr_t ControlTask_attributes = {
  .name = "ControlTask",
  .stack_size = 256 * 4,
  .priority = (osPriority_t) osPriorityAboveNormal,
};
/* Definitions for SafetyTask */
osThreadId_t SafetyTaskHandle;
const osThreadAttr_t SafetyTask_attributes = {
  .name = "SafetyTask",
  .stack_size = 256 * 4,
  .priority = (osPriority_t) osPriorityHigh,
};
/* Definitions for CommRxTask */
osThreadId_t CommRxTaskHandle;
const osThreadAttr_t CommRxTask_attributes = {
  .name = "CommRxTask",
  .stack_size = 256 * 4,
  .priority = (osPriority_t) osPriorityBelowNormal,
};
/* Definitions for DockTask */
osThreadId_t DockTaskHandle;
const osThreadAttr_t DockTask_attributes = {
  .name = "DockTask",
  .stack_size = 256 * 4,
  .priority = (osPriority_t) osPriorityNormal,
};

/* Private function prototypes -----------------------------------------------*/
/* USER CODE BEGIN FunctionPrototypes */

/* USER CODE END FunctionPrototypes */

void StartControlTask(void *argument);
void StartSafetyTask(void *argument);
void StartCommRxTask(void *argument);
void StartDockTask(void *argument);

void MX_FREERTOS_Init(void); /* (MISRA C 2004 rule 8.1) */

/**
  * @brief  FreeRTOS initialization
  * @param  None
  * @retval None
  */
void MX_FREERTOS_Init(void) {
  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* USER CODE BEGIN RTOS_MUTEX */
  /* add mutexes, ... */
  /* USER CODE END RTOS_MUTEX */

  /* USER CODE BEGIN RTOS_SEMAPHORES */
  /* add semaphores, ... */
  /* USER CODE END RTOS_SEMAPHORES */

  /* USER CODE BEGIN RTOS_TIMERS */
  /* start timers, add new ones, ... */
  /* USER CODE END RTOS_TIMERS */

  /* USER CODE BEGIN RTOS_QUEUES */
	cmdQueue = osMessageQueueNew(1, sizeof(Cmd), NULL);
  /* USER CODE END RTOS_QUEUES */

  /* Create the thread(s) */
  /* creation of ControlTask */
  ControlTaskHandle = osThreadNew(StartControlTask, NULL, &ControlTask_attributes);

  /* creation of SafetyTask */
  SafetyTaskHandle = osThreadNew(StartSafetyTask, NULL, &SafetyTask_attributes);

  /* creation of CommRxTask */
  CommRxTaskHandle = osThreadNew(StartCommRxTask, NULL, &CommRxTask_attributes);

  /* creation of DockTask */
  DockTaskHandle = osThreadNew(StartDockTask, NULL, &DockTask_attributes);

  /* USER CODE BEGIN RTOS_THREADS */
  /* add threads, ... */
  /* USER CODE END RTOS_THREADS */

  /* USER CODE BEGIN RTOS_EVENTS */
  /* add events, ... */
  /* USER CODE END RTOS_EVENTS */

}

/* USER CODE BEGIN Header_StartControlTask */
/**
  * @brief  Function implementing the ControlTask thread.
  * @param  argument: Not used
  * @retval None
  */
static inline void rxbuf_push(uint8_t b)
{
    uint16_t next = (uint16_t)((s_rx_head + 1) % RXBUF_SIZE);
    if (next == s_rx_tail) {
        // overflow: oldest drop
        s_rx_tail = (uint16_t)((s_rx_tail + 1) % RXBUF_SIZE);
    }
    s_rxbuf[s_rx_head] = b;
    s_rx_head = next;
}

static inline int rxbuf_pop(uint8_t *out)
{
    if (s_rx_tail == s_rx_head) return 0;
    *out = s_rxbuf[s_rx_tail];
    s_rx_tail = (uint16_t)((s_rx_tail + 1) % RXBUF_SIZE);
    return 1;
}

// USART2 RX complete callback (IRQ context)
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART2) {
        rxbuf_push(s_rx_byte);

        // wake CommRxTask
        if (CommRxTaskHandle != NULL) {
            osThreadFlagsSet(CommRxTaskHandle, UART_RX_FLAG);
        }

        // re-arm 1 byte receive
        (void)HAL_UART_Receive_IT(huart, &s_rx_byte, 1);
    }
}

void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART2) {
        // try recover: restart IT reception
        (void)HAL_UART_AbortReceive_IT(huart);
        (void)HAL_UART_Receive_IT(huart, &s_rx_byte, 1);
    }
}

/* USER CODE END Header_StartControlTask */
void StartControlTask(void *argument)
{
  /* USER CODE BEGIN StartControlTask */
	Cmd cmd = {0};
	uint8_t inited = 0;

	for (;;)
	{
		// 1) HW init (한 번만)
		if (!inited)
		{
			DC_Motor_Init();
			Steer_Init();
			inited = 1;

			// 안전 기본값
			DC_Motor_SetSpeedPercent(0);
			DC_Motor_Enable(false);
			Steer_SetPercent(0);
		}

		// 2) 최신 명령 갱신 (큐 1칸: 있으면 바로 갱신)
		if (osMessageQueueGet(cmdQueue, &cmd, NULL, 0) == osOK)
		{
			g_latest_cmd = cmd;
		}

		uint32_t now = osKernelGetTickCount();

		// 3) 기본 출력값 계산
		int8_t out_speed = 0;
		int8_t out_steer = 0;

		// 4) 안전 조건(우선순위 높음)
		const uint8_t enabled = (g_rx_flags & FLAG_ENABLE) ? 1 : 0;
		const uint8_t timeout = ((now - last_cmd_tick) > CMD_FRESH_MS) ? 1 : 0;

		if (g_safe_stop || !enabled || timeout || estop_latched)
		{
			// 모터 확실히 정지 + 드라이버 off
			out_speed = 0;
			out_steer = 0;

			DC_Motor_SetSpeedPercent(0);
			DC_Motor_Enable(false);

			// 조향은 보통 중립 유지(드라이버 off 개념이 아니라 PWM 유지가 자연스러움)
			Steer_SetPercent(0);
		}
		else
		{
			// 5) 정상 제어: cmd를 그대로 percent로 반영
			out_speed = g_latest_cmd.speed; // -100 ~ +100 기대
			out_steer = g_latest_cmd.steer; // -100 ~ +100 기대

			// 모터/조향 적용
			DC_Motor_Enable(true);
			DC_Motor_SetSpeedPercent(out_speed);
			Steer_SetPercent(out_steer);
		}

		// 6) 모니터링용 전역값 업데이트
		g_out_speed = out_speed;
		g_out_steer = out_steer;

		osDelay(CONTROL_PERIOD_MS);

		printf("[Control] en=%d to=%d estop=%d safe=%d  cmd(sp=%d st=%d) out(sp=%d st=%d)\r\n",
		       enabled, timeout, estop_latched, g_safe_stop,
		       (int)g_latest_cmd.speed, (int)g_latest_cmd.steer,
		       (int)out_speed, (int)out_steer);

	}
  /* USER CODE END StartControlTask */
}

/* USER CODE BEGIN Header_StartSafetyTask */
/**
* @brief Function implementing the SafetyTask thread.
* @param argument: Not used
* @retval None
*/
/* USER CODE END Header_StartSafetyTask */
void StartSafetyTask(void *argument)
{
  /* USER CODE BEGIN StartSafetyTask */

  const uint32_t T_TIMEOUT_MS = 200;
  uint8_t last_state = 0xFF;

  for (;;)
  {
		uint32_t now = osKernelGetTickCount();

		// 0=OK, 1=TIMEOUT, 2=ESTOP, 3=DISABLED
		uint8_t state = 0;
		if (estop_latched) state = 2;
		else if ((now - last_cmd_tick) > CMD_FRESH_MS) state = 1;
		else if ((g_rx_flags & FLAG_ENABLE) == 0) state = 3;

		if (state != last_state)
		{
			last_state = state;
			if (state == 0)      printf("[Safety] OK\r\n");
			else if (state == 1) printf("[Safety] TIMEOUT -> HARD STOP\r\n");
			else if (state == 2) printf("[Safety] ESTOP -> HARD STOP\r\n");
			else                 printf("[Safety] DISABLED -> SAFE\r\n");
		}

		if (state != 0)
		{
			// ---- 최종 권한: 하드 정지 ----
			g_safe_stop = 1;

			g_out_speed = 0;
			g_out_steer = 0;

			// 모터: duty 0 + STBY OFF(하드컷)
			DC_Motor_SetSpeedPercent(0);
			DC_Motor_Enable(false);

			// 조향: 중립/도킹 포즈로 보내기
			// Dock_SafePose()가 steer까지 포함한다면 Steer_SetPercent(0)은 생략 가능
			Steer_SetPercent(0);

			// 도킹 장치(리프트/클램프) 안전 자세
			Dock_SafePose();
		}
		else
		{
			// OK 상태
			g_safe_stop = 0;
			// 여기서 굳이 DC_Motor_Enable(true) 같은 걸 하지 말고,
			// ControlTask가 정상 제어에서 enable 하도록 두는 게 안전함.
		}
		osDelay(10);
  }
  /* USER CODE END StartSafetyTask */
}

/* USER CODE BEGIN Header_StartCommRxTask */
/**
* @brief Function implementing the commRxTask thread.
* @param argument: Not used
* @retval None
*/
extern UART_HandleTypeDef huart2;

static int uart_read_byte_blocking(uint8_t* out)
{
  return (HAL_UART_Receive(&huart2, out, 1, HAL_MAX_DELAY) == HAL_OK);
}

/* USER CODE END Header_StartCommRxTask */
void StartCommRxTask(void *argument)
{
  /* USER CODE BEGIN StartCommRxTask */
    Cmd cmd = {0};
    uint8_t b;
    uint8_t buf[PKT_LEN];
    uint8_t idx = 0;

    uint32_t last_ok_print  = 0;
    uint32_t last_stat_print = 0;

    // 디버그 카운터 (전역으로 빼도 되는데, 일단 여기 static으로)
    static uint32_t rx_byte_cnt = 0;
    static uint32_t rx_pkt_ok   = 0;
    static uint32_t rx_pkt_bad  = 0;

    // arm UART RX interrupt
    (void)HAL_UART_Receive_IT(&huart2, &s_rx_byte, 1);

    for (;;)
    {
        // wait until at least 1 byte arrives
        //(void)osThreadFlagsWait(UART_RX_FLAG, osFlagsWaitAny, osWaitForever);
        uint32_t f = osThreadFlagsWait(UART_RX_FLAG, osFlagsWaitAny, 1000); // 1초
        // consume all buffered bytes

        // (옵션) timeout이면 한 줄 찍어서 "flag가 안 온다"를 확정
				if (f == (uint32_t)osFlagsErrorTimeout) {
						// 여기서도 상태 요약 찍어주면 좋음
						uint32_t now2 = osKernelGetTickCount();
						if (now2 - last_stat_print >= 1000) {
								last_stat_print = now2;
								printf("[RxSTAT] (timeout) bytes=%lu ok=%lu bad=%lu last_cmd=%lu flags=0x%02X\r\n",
											 (unsigned long)rx_byte_cnt,
											 (unsigned long)rx_pkt_ok,
											 (unsigned long)rx_pkt_bad,
											 (unsigned long)last_cmd_tick,
											 (unsigned)g_rx_flags);
						}
						continue; // timeout이면 pop할 것도 없으니 다음 루프
				}
        while (rxbuf_pop(&b))
        {
            rx_byte_cnt++;  // ✅ 여기: "바이트를 실제로 꺼냈다" 카운트

            // --- packet framing: AA 55 + 6 bytes ---
            if (idx == 0) {
                if (b == PKT_MAGIC0) buf[idx++] = b;
                continue;
            }
            if (idx == 1) {
                if (b == PKT_MAGIC1) buf[idx++] = b;
                else idx = 0;
                continue;
            }

            buf[idx++] = b;

            if (idx >= PKT_LEN) {
                idx = 0;

                if (pkt_validate(buf)) {
                    rx_pkt_ok++;

                    uint32_t now = osKernelGetTickCount();
                    pkt_to_cmd(buf, &cmd, now);

                    last_cmd_tick = now;
                    g_rx_flags = cmd.flags;
                    if (cmd.flags & FLAG_ESTOP) estop_latched = 1;

                    // queue 1칸이면 "최신값 덮어쓰기"가 정석
                    if (osMessageQueuePut(cmdQueue, &cmd, 0, 0) != osOK) {
                        Cmd dummy;
                        (void)osMessageQueueGet(cmdQueue, &dummy, NULL, 0);
                        (void)osMessageQueuePut(cmdQueue, &cmd, 0, 0);
                    }

                    // OK 로그 (0.5초에 한 번)
                    if (now - last_ok_print >= 500) {
                        last_ok_print = now;
                        printf("[RxOK] bytes=%lu ok=%lu bad=%lu  seq=%u flags=0x%02X sp=%d st=%d\r\n",
                               (unsigned long)rx_byte_cnt,
                               (unsigned long)rx_pkt_ok,
                               (unsigned long)rx_pkt_bad,
                               (unsigned)cmd.seq,
                               (unsigned)cmd.flags,
                               (int)cmd.speed,
                               (int)cmd.steer);
                    }
                }
                else {
                    rx_pkt_bad++;

                    // BAD 로그는 너무 도배되니까 "처음 20개만" + 헤더/CRC만 보여주기
                    if (rx_pkt_bad <= 20) {
                        printf("[RxBAD #%lu] hdr=%02X %02X  data=%02X %02X %02X %02X  crc=%02X %02X\r\n",
                               (unsigned long)rx_pkt_bad,
                               buf[0], buf[1],
                               buf[2], buf[3], buf[4], buf[5],
                               buf[6], buf[7]);
                    }
                }
            }
        }

        // 상태 요약(1초에 한 번) - 바이트가 전혀 안 들어오는지 바로 확인용
        uint32_t now2 = osKernelGetTickCount();
        if (now2 - last_stat_print >= 1000) {
            last_stat_print = now2;
            printf("[RxSTAT] bytes=%lu ok=%lu bad=%lu last_cmd=%lu flags=0x%02X\r\n",
                   (unsigned long)rx_byte_cnt,
                   (unsigned long)rx_pkt_ok,
                   (unsigned long)rx_pkt_bad,
                   (unsigned long)last_cmd_tick,
                   (unsigned)g_rx_flags);
        }
    }
  /* USER CODE END StartCommRxTask */
}

/* USER CODE BEGIN Header_StartDockTask */
/**
* @brief Function implementing the DockTask thread.
* @param argument: Not used
* @retval None
*/
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

/* USER CODE END Header_StartDockTask */
void StartDockTask(void *argument)
{
  /* USER CODE BEGIN StartDockTask */
  Dock_InitPwm();
  Dock_SetAbortChecker(dock_abort_check);
  Dock_SafePose();

  uint8_t prev_start = 0;
  uint8_t prev_abort = 0;

  /* Infinite loop */
  for (;;)
  {
  	uint8_t f = g_rx_flags;
  	uint8_t start = (f & FLAG_DOCK_START) ? 1 : 0;
  	uint8_t abort = (f & FLAG_DOCK_ABORT) ? 1 : 0;

    // 안전정지면 계속 safe
    if (g_safe_stop) {
      Dock_SafePose();
      prev_start = start;
      prev_abort = abort;
      osDelay(10);
      continue;
    }

    // abort 엣지(0->1)면 해제 시퀀스
    if (!prev_abort && abort) {
      Dock_RunReleaseSequence();
    }

    // start 엣지(0->1)면 도킹 시퀀스
    if (!prev_start && start && !abort) {
      Dock_RunDockSequence();
    }

    prev_start = start;
    prev_abort = abort;
    osDelay(10);
  }
  /* USER CODE END StartDockTask */
}

/* Private application code --------------------------------------------------*/
/* USER CODE BEGIN Application */


/* USER CODE END Application */

