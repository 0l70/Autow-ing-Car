import argparse
import asyncio
import json
import logging
import uuid
import cv2
import platform
import os
import requests
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCConfiguration, RTCIceServer, VideoStreamTrack
import websockets
from av import VideoFrame
try:
    from aiortc.sdp import candidate_from_sdp
except ImportError:
    from aiortc.rtcicetransport import candidate_from_sdp
# ==========================================
# [설정] 환경변수 혹은 기본값
# ==========================================
# 사용자 요청 IP 반영
DEFAULT_HOST_IP = "70.12.246.52"
DEFAULT_PORT = "8080"
# 로그인 정보
LOGIN_EMAIL = os.environ.get("LOGIN_EMAIL", "pilot@atc.com")
LOGIN_PW = os.environ.get("LOGIN_PW", "1234")
# ID 설정
CAR_ID = os.environ.get("CAR_ID", "CAR_102")
PILOT_ID = os.environ.get("PILOT_ID", "PILOT_001")
# URL 조립
LOGIN_URL = "http://{}:{}/api/auth/login".format(DEFAULT_HOST_IP, DEFAULT_PORT)
SERVER_WS_BASE = "ws://{}:{}/ws-server/websocket".format(DEFAULT_HOST_IP, DEFAULT_PORT)
# 카메라 설정
VIDEO_DEVICE_INDEX = int(os.environ.get("VIDEO_DEVICE_INDEX", "0"))
WIDTH = int(os.environ.get("WIDTH", "640"))
HEIGHT = int(os.environ.get("HEIGHT", "480"))
FPS = int(os.environ.get("FPS", "30"))
# ICE Server
ICE_SERVERS = [
    RTCIceServer(urls=["turn:i14a402.p.ssafy.io:8000"], username="myuser", credential="mypassword"),
    RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
]
RTC_CONFIG = RTCConfiguration(iceServers=ICE_SERVERS)
# ==========================================
def login_and_get_token():
    print("[Login] Trying to login to {} as {}...".format(LOGIN_URL, LOGIN_EMAIL))
    try:
        resp = requests.post(LOGIN_URL, json={
            "email": LOGIN_EMAIL,
            "password": LOGIN_PW
        }, timeout=5)
        if resp.status_code != 200:
            print("[Login] Failed: {} {}".format(resp.status_code, resp.text))
            return None
        token = resp.json().get("socketToken")
        print("[Login] Success! Token acquired.")
        return token
    except Exception as e:
        print("[Login] Error: {}".format(e))
        return None
def stomp_frame(cmd, headers, body=""):
    # 헤더 조립
    header_str = ""
    for k, v in headers.items():
        header_str += "{}:{}\n".format(k, v)
    return "{}\n{}\n{}\0".format(cmd, header_str, body)
def parse_stomp_message(frame):
    if not frame or "MESSAGE" not in frame:
        return None
    parts = frame.split("\n\n", 1)
    if len(parts) != 2:
        return None
    body = parts[1].replace("\0", "").strip()
    try:
        return json.loads(body)
    except:
        return None
class CameraStreamTrack(VideoStreamTrack):
    def __init__(self, device_index=0, width=640, height=480, fps=30):
        super().__init__()
        self.cap = cv2.VideoCapture(device_index)
        if not self.cap.isOpened():
            raise RuntimeError("Failed to open camera device index={}".format(device_index))
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
    async def recv(self):
        pts, time_base = await self.next_timestamp()
        ret, frame = self.cap.read()
        if not ret or frame is None:
            await asyncio.sleep(0.01)
            return await self.recv()
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        vf = VideoFrame.from_ndarray(frame, format="rgb24")
        vf.pts = pts
        vf.time_base = time_base
        return vf
    def stop(self):
        if self.cap:
            self.cap.release()
        super().stop()
async def main():
    # 1. 로그인
    token = login_and_get_token()
    if not token:
        print("[System] Login failed. Exiting.")
        return
    # 2. WebSocket URL 생성
    full_ws_url = "{}?socket_token={}".format(SERVER_WS_BASE, token)
    print("==== Jetson WebRTC Cam Sender (On-Demand v3) ====")
    print("Server: {}".format(full_ws_url))
    print("Target: {}".format(PILOT_ID))
    # RTCPeerConnection & Camera (전역 유지)
    pc = RTCPeerConnection(RTC_CONFIG)
    cam_track = CameraStreamTrack(VIDEO_DEVICE_INDEX, WIDTH, HEIGHT, FPS)
    # Track은 미리 추가
    pc.addTrack(cam_track)
    send_q = asyncio.Queue()
    # --- Helper: Start Streaming ---
    async def start_streaming():
        print("[Control] START Command Received! Initiating WebRTC...")
        
        # 1. Create Offer
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        # 2. Vanilla ICE Wait (2초 대기)
        print("[WebRTC] Gathering ICE candidates (2s)...")
        await asyncio.sleep(2)
        
        # 3. Send Offer (with Candidates)
        final_sdp = pc.localDescription.sdp
        payload = {
            "type": "OFFER",
            "sdp": final_sdp,
            "senderId": CAR_ID,
            "receiverId": PILOT_ID,
        }
        headers = {"destination": "/app/video/offer", "content-type": "application/json"}
        await send_q.put(stomp_frame("SEND", headers, json.dumps(payload)))
        print("[WebRTC] OFFER Sent!")
    async def ws_sender(ws):
        while True:
            msg = await send_q.get()
            if msg is None: return
            await ws.send(msg)
    # 3. Connect & Listen
    async with websockets.connect(full_ws_url, subprotocols=["v12.stomp"]) as ws:
        sender_task = asyncio.create_task(ws_sender(ws))
        # STOMP CONNECT
        await send_q.put(stomp_frame("CONNECT", { "accept-version": "1.2", "host": "localhost" }))
        # Wait for CONNECTED
        first_msg = await ws.recv()
        if "CONNECTED" in first_msg:
            print("[STOMP] CONNECTED & WAITING FOR COMMAND...")
        else:
            print("[STOMP] Unexpected: {}".format(first_msg[:50]))
        
        # SUBSCRIBE to Control Topic (명령 대기)
        sub_ctrl = {"id": "sub-ctrl", "destination": "/topic/video/control/{}".format(CAR_ID)}
        await send_q.put(stomp_frame("SUBSCRIBE", sub_ctrl))
        # SUBSCRIBE to Answer/ICE (Video Signaling)
        sub_ans = {"id": "sub-ans", "destination": "/topic/video/answer/{}".format(CAR_ID)}
        await send_q.put(stomp_frame("SUBSCRIBE", sub_ans))
        sub_ice = {"id": "sub-ice", "destination": "/topic/video/ice/{}".format(CAR_ID)}
        await send_q.put(stomp_frame("SUBSCRIBE", sub_ice))
        # Main Loop
        async for raw in ws:
            data = parse_stomp_message(raw)
            if not data: continue
            t = data.get("type")
            
            # [Control] START
            if t == "START":
                await start_streaming()
            
            # [Signaling] ANSWER
            elif t == "ANSWER":
                print("[WebRTC] ANSWER Received")
                await pc.setRemoteDescription(RTCSessionDescription(sdp=data["sdp"], type="answer"))
            
            # [Signaling] ICE
            elif t == "ICE":
                print("[WebRTC] ICE Received")
                try:
                    cand = candidate_from_sdp(data["candidate"])
                    cand.sdpMid = data.get("sdpMid", "0")
                    cand.sdpMLineIndex = int(data.get("sdpMLineIndex", 0))
                    await pc.addIceCandidate(cand)
                except Exception as e:
                    print("ICE Error: {}".format(e))
        await send_q.put(None)
        await sender_task
        await pc.close()
        cam_track.stop()
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass