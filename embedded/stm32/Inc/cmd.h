/*
 * cmd.h
 *
 *  Created on: Jan 27, 2026
 *      Author: SSAFY
 */

#ifndef INC_CMD_H_
#define INC_CMD_H_

#include <stdint.h>
#include "cmsis_os2.h"
#include "main.h"

#define PKT_MAGIC0 0xAA
#define PKT_MAGIC1 0x55
#define PKT_LEN    8

// flags bit
#define FLAG_ENABLE     (1u<<0) // 0x01
#define FLAG_ESTOP      (1u<<1) // 0x02
#define FLAG_DOCK_START (1u<<2) // 0x04
#define FLAG_DOCK_ABORT (1u<<3) // 0x08

// CRC16/IBM(MODBUS) init=0xFFFF poly=0xA001, input bytes[0..5]
uint16_t crc16_ibm(const uint8_t* data, uint16_t len);

// 8-byte packet validate (magic + crc)
int pkt_validate(const uint8_t pkt[PKT_LEN]);

// packet -> Cmd (project Cmd struct 형태에 맞춰 채움)
// Cmd는 freertos.c에서 쓰는 그 Cmd 그대로 쓰는 걸 가정.
typedef struct {
  uint8_t seq;
  uint8_t flags;
  int8_t  speed;  // packet[4]
  int8_t  steer;  // packet[5]
  uint32_t t_ms;  // 수신 시각 tick
} Cmd;

void pkt_to_cmd(const uint8_t pkt[PKT_LEN], Cmd* out, uint32_t now_tick);

#endif /* INC_CMD_H_ */
