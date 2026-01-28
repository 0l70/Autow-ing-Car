/*
 * cmd.c
 *
 *  Created on: Jan 27, 2026
 *      Author: SSAFY
 */


#include "cmd.h"

volatile uint32_t g_rx_byte_cnt = 0;
volatile uint32_t g_rx_pkt_ok   = 0;
volatile uint32_t g_rx_pkt_bad  = 0;


uint16_t crc16_ibm(const uint8_t* data, uint16_t len)
{
  uint16_t crc = 0xFFFF;
  for (uint16_t i=0; i<len; i++) {
    crc ^= data[i];
    for (int j=0; j<8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xA001;
      else         crc >>= 1;
    }
  }
  return crc;
}

//int pkt_validate(const uint8_t pkt[PKT_LEN])
//{
//  if (pkt[0] != PKT_MAGIC0 || pkt[1] != PKT_MAGIC1) return 0;
//
//  uint16_t crc_calc = crc16_ibm(pkt, 6); // byte0~5
//  uint16_t crc_rx   = (uint16_t)pkt[6] | ((uint16_t)pkt[7] << 8);
//  return (crc_calc == crc_rx);
//}

int pkt_validate(const uint8_t pkt[PKT_LEN])
{
  if (pkt[0] != PKT_MAGIC0 || pkt[1] != PKT_MAGIC1) return 0;

  uint16_t crc_calc = crc16_ibm(pkt, 6); // byte0~5

  uint16_t crc_rx_le = (uint16_t)pkt[6] | ((uint16_t)pkt[7] << 8);      // CA 9B
  uint16_t crc_rx_be = ((uint16_t)pkt[6] << 8) | (uint16_t)pkt[7];      // 9B CA

  return (crc_calc == crc_rx_le) || (crc_calc == crc_rx_be);
}


void pkt_to_cmd(const uint8_t pkt[PKT_LEN], Cmd* out, uint32_t now_tick)
{
  out->seq   = pkt[2];
  out->flags = pkt[3];
  out->speed = (int8_t)pkt[4];
  out->steer = (int8_t)pkt[5];
  out->t_ms  = now_tick; // cmd.h에 t_ms 없으면 이 줄 삭제 or 필드 추가
}
