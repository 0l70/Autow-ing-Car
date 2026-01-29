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
#include "app_shared.h"
#include "drivers/dock.h"
#include "drivers/steer_servo.h"

// Task headers
#include "tasks/controlTask.h"
#include "tasks/safetyTask.h"
#include "tasks/uartRxTask.h"
#include "tasks/dockTask.h"

/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
/* USER CODE BEGIN Variables */


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
/* Definitions for UartRxTask */
osThreadId_t UartRxTaskHandle;
const osThreadAttr_t UartRxTask_attributes = {
  .name = "UartRxTask",
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
void StartUartRxTask(void *argument);
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

  /* creation of UartRxTask */
  UartRxTaskHandle = osThreadNew(StartUartRxTask, NULL, &UartRxTask_attributes);

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

/* USER CODE END Header_StartControlTask */
void StartControlTask(void *argument)
{
  /* USER CODE BEGIN StartControlTask */
	AppControlTask(argument);
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
	AppSafetyTask(argument);
  /* USER CODE END StartSafetyTask */
}

/* USER CODE BEGIN Header_StartUartRxTask */
/**
* @brief Function implementing the UartRxTask thread.
* @param argument: Not used
* @retval None
*/
/* USER CODE END Header_StartUartRxTask */
void StartUartRxTask(void *argument)
{
  /* USER CODE BEGIN StartUartRxTask */
  AppUartRxTask(argument);
  /* USER CODE END StartUartRxTask */
}

/* USER CODE BEGIN Header_StartDockTask */
/**
* @brief Function implementing the DockTask thread.
* @param argument: Not used
* @retval None
*/

/* USER CODE END Header_StartDockTask */
void StartDockTask(void *argument)
{
  /* USER CODE BEGIN StartDockTask */
  AppDockTask(argument);
  /* USER CODE END StartDockTask */
}

/* Private application code --------------------------------------------------*/
/* USER CODE BEGIN Application */


/* USER CODE END Application */

