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
    print("[Login] Trying to login to {}...".format(LOGIN_URL))
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
    frame = "{}\n".format(cmd)
    for k, v in headers.items():
        frame += "{}:{}\n".format(k, v)
    frame += "\n{}\0".format(body)
    return frame

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
        self.running = True 
        if not self.cap.isOpened():
            raise RuntimeError("Failed to open camera device index={}".format(device_index))
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
    async def recv(self):
        # [PAUSE 로직 수정] 재귀 대신 루프로 대기
        while not self.running:
            await asyncio.sleep(0.1)
        pts, time_base = await self.next_timestamp()
        ret, frame = self.cap.read()
        if not ret or frame is None:
            await asyncio.sleep(0.01)
            # 여기서는 어쩔 수 없이 재귀 (프레임 읽기 실패시만)
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
    
    def pause(self):
        print("[Camera] PAUSED (Streaming Suspended)")
        self.running = False
    
    def resume(self):
        print("[Camera] RESUMED (Streaming Active)")
        self.running = True

async def main():
    token = login_and_get_token()
    if not token: return
    full_ws_url = "{}?socket_token={}".format(SERVER_WS_BASE, token)
    print("==== Jetson WebRTC Cam Sender (v5: Video Fix) ====")
    print("Server: {}".format(full_ws_url))
    pc = RTCPeerConnection(RTC_CONFIG)
    cam_track = CameraStreamTrack(VIDEO_DEVICE_INDEX, WIDTH, HEIGHT, FPS)
    pc.addTrack(cam_track)
    send_q = asyncio.Queue()
    async def start_streaming():
        print("[WebRTC] START Command Received! Generating Offer...")
        cam_track.resume()
        
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        print("[WebRTC] Gathering ICE candidates (2s)...")
        await asyncio.sleep(2)
        
        final_sdp = pc.localDescription.sdp
        payload = {
            "type": "OFFER",
            "sdp": final_sdp,
            "senderId": CAR_ID,
            "receiverId": PILOT_ID,
        }
        headers = {"destination": "/app/video/offer", "content-type": "application/json"}
        await send_q.put(stomp_frame("SEND", headers, json.dumps(payload)))
        print("[WebRTC] OFFER Sent to {}".format(PILOT_ID))
    async def ws_sender(ws):
        while True:
            msg = await send_q.get()
            if msg is None: return
            await ws.send(msg)
    async with websockets.connect(full_ws_url, subprotocols=["v12.stomp"]) as ws:
        sender_task = asyncio.create_task(ws_sender(ws))
        # STOMP CONNECT
        await send_q.put(stomp_frame("CONNECT", { "accept-version": "1.2", "host": "localhost" }))
        # Wait for CONNECTED
        first_msg = await ws.recv()
        if "CONNECTED" in first_msg:
            print("[STOMP] CONNECTED & Waiting for START command...")
        
        # SUBSCRIBE
        await send_q.put(stomp_frame("SUBSCRIBE", {"id": "sub-ctrl", "destination": "/topic/video/control/{}".format(CAR_ID)}))
        await send_q.put(stomp_frame("SUBSCRIBE", {"id": "sub-ans", "destination": "/topic/video/answer/{}".format(CAR_ID)}))
        await send_q.put(stomp_frame("SUBSCRIBE", {"id": "sub-ice", "destination": "/topic/video/ice/{}".format(CAR_ID)}))
        # Main Loop
        async for raw in ws:
            data = parse_stomp_message(raw)
            if not data: continue
            t = data.get("type")
            if t == "START":
                await start_streaming()
            elif t == "PAUSE":
                cam_track.pause()
            elif t == "RESUME":
                cam_track.resume()
            elif t == "ANSWER":
                print("[WebRTC] ANSWER Received!")
                await pc.setRemoteDescription(RTCSessionDescription(sdp=data["sdp"], type="answer"))
            elif t == "ICE":
                print("[WebRTC] ICE Candidate Received")
                try:
                    cand = candidate_from_sdp(data["candidate"])
                    cand.sdpMid = data.get("sdpMid", "0")
                    cand.sdpMLineIndex = int(data.get("sdpMLineIndex", 0))
                    await pc.addIceCandidate(cand)
                except Exception as e:
                    print("[WebRTC] ICE Error: {}".format(e))
        await send_q.put(None)
        await sender_task
        await pc.close()
        cam_track.stop()

        
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass