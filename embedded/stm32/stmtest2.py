# send_uart_pkt.py
import argparse
import struct
import time
import serial

PKT_MAGIC0 = 0xAA
PKT_MAGIC1 = 0x55
PKT_LEN = 8

FLAG_ENABLE = 1 << 0
FLAG_ESTOP  = 1 << 1
FLAG_DOCK_START = 1 << 2
FLAG_DOCK_ABORT = 1 << 3

def crc16_ibm(data: bytes) -> int:
    """CRC16/IBM(MODBUS): init=0xFFFF poly=0xA001"""
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
    return crc & 0xFFFF

def clamp_i8(x: int) -> int:
    if x < -128: return -128
    if x > 127:  return 127
    return x

def build_packet(seq: int, flags: int, speed: int, steer: int) -> bytes:
    speed = clamp_i8(speed)
    steer = clamp_i8(steer)

    # first 6 bytes
    header = struct.pack(
        "<BBBBbb",
        PKT_MAGIC0,
        PKT_MAGIC1,
        seq & 0xFF,
        flags & 0xFF,
        speed,
        steer
    )
    crc = crc16_ibm(header)
    pkt = header + struct.pack("<H", crc)  # little-endian: [6]=lo, [7]=hi
    assert len(pkt) == PKT_LEN
    return pkt

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True, help="예: COM5")
    ap.add_argument("--baud", type=int, default=115200, help="CubeIDE UART baud와 맞추기")
    ap.add_argument("--hz", type=float, default=20.0, help="송신 주기(heartbeat). Safety timeout보다 충분히 빠르게")
    ap.add_argument("--speed", type=int, default=0, help="-100~100 권장 (STM에서 그대로 percent로 씀)")
    ap.add_argument("--steer", type=int, default=0, help="-100~100 권장")
    ap.add_argument("--enable", action="store_true", help="ENABLE 플래그 켜기")
    ap.add_argument("--estop", action="store_true", help="ESTOP 플래그 켜기(래치 걸릴 수 있음)")
    ap.add_argument("--dock_start", action="store_true")
    ap.add_argument("--dock_abort", action="store_true")
    args = ap.parse_args()

    flags = 0
    if args.enable:     flags |= FLAG_ENABLE
    if args.estop:      flags |= FLAG_ESTOP
    if args.dock_start: flags |= FLAG_DOCK_START
    if args.dock_abort: flags |= FLAG_DOCK_ABORT

    period = 1.0 / args.hz if args.hz > 0 else 0.05

    with serial.Serial(args.port, args.baud, timeout=0.1) as ser:
        # ser.reset_input_buffer()
        # ser.reset_output_buffer()

        seq = 0
        print(f"[OPEN] port={args.port} baud={args.baud} hz={args.hz} flags=0x{flags:02X}")
        try:
            while True:
                pkt = build_packet(seq, flags, args.speed, args.steer)
                ser.write(pkt)

                # (옵션) STM이 printf로 뭔가 뿌리면 읽어서 보기
                try:
                    rx = ser.read(256)
                    if rx:
                        # 깨지면 그냥 무시해도 됨
                        print("[RX]", rx.hex(" "))
                except Exception:
                    pass

                seq = (seq + 1) & 0xFF
                time.sleep(period)
        except KeyboardInterrupt:
            print("\n[STOP]")

if __name__ == "__main__":
    main()


"""
정상 주행(ENABLE 켜고 20Hz로 지속 송신)
python stmtest2.py --port COM3 --baud 115200 --hz 20 --enable --speed 50 --steer -10


그냥 정지 유지(ENABLE 켠 채 speed=0)
python stmtest2.py --port COM3 --enable --speed 0 --steer 0


E-STOP 패킷(코드상 estop_latched로 걸릴 수 있음 → 해제 로직 없으면 계속 멈춤)
python stmtest2.py --port COM3 --enable --estop --speed 0 --steer 0
"""