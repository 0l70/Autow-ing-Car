import cv2
import numpy as np
import time
from collections import deque
from ultralytics import YOLO

class MarshallerAI:
    def __init__(self, model_path='yolov8n-pose.pt'):
        self.model_name = model_path.split('.')[0]
        print(f"Loading {self.model_name} Model...")
        self.model = YOLO(model_path)
        
        # --- [설정] 파라미터 튜닝 ---
        self.maxlen = 15              
        self.conf_threshold = 0.5     
        
        # 1. 임계값 (Thresholds)
        self.cross_dist_threshold = 80.0    # STOP: 손목 교차 거리
        self.motion_threshold = 8.0         # 공통: 흔들림 감지 민감도
        self.elbow_stable_threshold = 25.0  # 공통: 팔꿈치 고정 허용범위 (좀 더 관대하게 25로 상향)
        
        # 2. 높이 판별 기준
        self.high_pose_margin = 120.0       # COME/TURN: 팔꿈치가 이 높이보다 위에 있어야 함
        self.low_pose_drop = 60.0           # BACK: 팔꿈치가 어깨보다 이만큼 아래에 있어야 함

        # 3. 상태 유지 (Hold)
        self.sustain_frames = 10  # 약 0.3초 유지
        self.current_sustain = 0
        self.last_valid_command = "STANDBY"

        # 4. [NEW] 안전장치 (Fail-Safe)
        self.last_human_time = time.time()
        self.safety_timeout = 0.5 # 0.5초 이상 사람 안 보이면 STOP

        # 히스토리 버퍼
        self.hist_lw = deque(maxlen=self.maxlen) 
        self.hist_rw = deque(maxlen=self.maxlen) 
        self.hist_le = deque(maxlen=self.maxlen) 
        self.hist_re = deque(maxlen=self.maxlen) 

        # [NEW] 지수 이동 평균(EMA) 필터용 변수 (좌표 보정)
        self.smooth_lw = None
        self.smooth_rw = None
        self.alpha = 0.6 # 최신 값 반영 비율 (0.6 = 신규 60%, 기존 40%)

    def predict(self, frame):
        start_time = time.time()
        results = self.model(frame, verbose=False)
        inference_time = (time.time() - start_time) * 1000

        # --- [1] 안전장치: 사람이 없는 경우 ---
        if results[0].keypoints is None or results[0].keypoints.data.shape[0] == 0:
            # 사람이 없어진 지 오래됐으면 비상 정지
            if time.time() - self.last_human_time > self.safety_timeout:
                self.draw_ui(frame, "EMERGENCY_STOP", 0, 0, False, False)
                return "STOP", frame # [중요] 명령은 STOP으로 나감
            else:
                return "NO_HUMAN", frame

        # 사람이 있으면 시간 갱신
        self.last_human_time = time.time()
        
        keypoints = results[0].keypoints.data[0].cpu().numpy()
        
        # 신뢰도 체크
        if min(keypoints[5][2], keypoints[6][2], keypoints[9][2], keypoints[10][2]) < self.conf_threshold:
            return "LOW_CONF", frame

        # --- [2] 좌표 추출 및 스무딩(Smoothing) ---
        # 5,6:어깨 / 7,8:팔꿈치 / 9,10:손목
        ls, rs = keypoints[5][:2], keypoints[6][:2]
        le, re = keypoints[7][:2], keypoints[8][:2]
        raw_lw, raw_rw = keypoints[9][:2], keypoints[10][:2]
        
        # EMA 필터 적용 (좌표 떨림 방지)
        if self.smooth_lw is None:
            self.smooth_lw, self.smooth_rw = raw_lw, raw_rw
        else:
            self.smooth_lw = self.alpha * raw_lw + (1 - self.alpha) * self.smooth_lw
            self.smooth_rw = self.alpha * raw_rw + (1 - self.alpha) * self.smooth_rw
        
        # 이제부터 lw, rw는 부드러워진 좌표 사용
        lw, rw = self.smooth_lw, self.smooth_rw

        # 히스토리 업데이트
        self.hist_lw.append(lw)
        self.hist_rw.append(rw)
        self.hist_le.append(le)
        self.hist_re.append(re)

        if len(self.hist_lw) < self.maxlen:
            return "GATHERING", frame

        # --- [3] 로직 데이터 계산 ---
        
        # 거리 및 흔들림(Motion) 계산
        wrist_dist = np.linalg.norm(lw - rw)
        
        lw_std = np.std([p[1] for p in self.hist_lw]) # 왼손 흔들림
        rw_std = np.std([p[1] for p in self.hist_rw]) # 오른손 흔들림
        
        le_std = np.std([p[1] for p in self.hist_le])
        re_std = np.std([p[1] for p in self.hist_re])
        elbow_motion = max(le_std, re_std) # 팔꿈치는 고정되어야 함

        # 높이(Pose) 분석
        shoulder_avg_y = (ls[1] + rs[1]) / 2
        
        # 왼팔/오른팔 각각 높이 체크 (Y값이 작아야 위쪽)
        # 어깨보다 +margin(아래)보다 작으면(위면) High로 간주
        is_left_high = np.mean([p[1] for p in self.hist_le]) < (shoulder_avg_y + self.high_pose_margin)
        is_right_high = np.mean([p[1] for p in self.hist_re]) < (shoulder_avg_y + self.high_pose_margin)
        
        # 백(Back) 자세 체크 (어깨보다 확실히 아래)
        avg_elbow_y = (np.mean([p[1] for p in self.hist_le]) + np.mean([p[1] for p in self.hist_re])) / 2
        is_elbow_low = avg_elbow_y > (shoulder_avg_y + self.low_pose_drop)

        # --- [4] 판정 트리 (Decision Tree) ---
        raw_command = "STANDBY"

        # 조건 1: STOP (최우선) - X자 교차
        if wrist_dist < self.cross_dist_threshold:
            raw_command = "STOP"
            self.current_sustain = 0
            
        # 조건 2: 동작 감지 (팔꿈치 고정 + 손목 흔들림)
        elif (elbow_motion < self.elbow_stable_threshold):
            
            # [NEW] 편측 제어 (한쪽만 흔들기)
            # 왼쪽만 흔들고 + 높음 -> LEFT
            if (lw_std > self.motion_threshold) and (rw_std < self.motion_threshold) and is_left_high:
                raw_command = "LEFT"
                self.current_sustain = self.sustain_frames
            
            # 오른쪽만 흔들고 + 높음 -> RIGHT
            elif (rw_std > self.motion_threshold) and (lw_std < self.motion_threshold) and is_right_high:
                raw_command = "RIGHT"
                self.current_sustain = self.sustain_frames

            # 양쪽 다 흔듦
            elif (lw_std > self.motion_threshold) and (rw_std > self.motion_threshold):
                if is_left_high and is_right_high:
                    raw_command = "COME" # 둘 다 높음
                    self.current_sustain = self.sustain_frames
                elif is_elbow_low:
                    raw_command = "BACK" # 둘 다 낮음
                    self.current_sustain = self.sustain_frames

        # --- [5] 후처리 (Hold) ---
        final_command = raw_command
        if raw_command == "STOP":
            final_command = "STOP"
        elif raw_command != "STANDBY":
            final_command = raw_command
            self.last_valid_command = raw_command
        else:
            if self.current_sustain > 0:
                final_command = self.last_valid_command
                self.current_sustain -= 1
            else:
                final_command = "STANDBY"

        # 시각화
        self.draw_skeleton(frame, ls, rs, le, re, lw, rw)
        self.draw_ui(frame, final_command, max(lw_std, rw_std), elbow_motion, (is_left_high and is_right_high), is_elbow_low)
        self.draw_performance(frame, start_time, inference_time)

        return final_command, frame

    def draw_skeleton(self, frame, ls, rs, le, re, lw, rw):
        # 뼈대 그리기
        colors = (200, 200, 200)
        for p1, p2 in [(ls, le), (le, lw), (rs, re), (re, rw), (ls, rs)]:
            cv2.line(frame, (int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1])), colors, 2)
        # 관절 점
        for kp in [ls, rs, le, re, lw, rw]:
            cv2.circle(frame, (int(kp[0]), int(kp[1])), 5, (0, 255, 0), -1)

    def draw_ui(self, frame, cmd, w_mot, e_mot, is_high, is_low):
        # 화면 크기
        h, w, _ = frame.shape
        
        # 박스 (오른쪽 하단)
        box_w, box_h, margin = 300, 50, 0
        sx, sy = w - box_w - margin, h - box_h - margin
        
        color_map = {
            "STOP": (0, 0, 255),     "EMERGENCY_STOP": (0, 0, 255),
            "COME": (0, 255, 0),     "BACK": (0, 165, 255),
            "LEFT": (255, 0, 0),     "RIGHT": (255, 0, 0), # 좌우는 파랑
            "STANDBY": (100, 100, 100)
        }
        color = color_map.get(cmd, (100, 100, 100))

        cv2.rectangle(frame, (sx, sy), (w-margin, h-margin), (0,0,0), -1)
        
        # 텍스트
        font_scale = 0.9 if len(cmd) < 10 else 0.7 # 글자 길면 작게
        cv2.putText(frame, f"CMD: {cmd}", (sx + 10, sy + 35), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, 2)

        # 디버깅 정보 (왼쪽 하단)
        pose_str = "HIGH" if is_high else ("LOW" if is_low else "MID")
        debug_msg = f"Mot:{w_mot:.1f} Elb:{e_mot:.1f} Pose:{pose_str}"
        cv2.putText(frame, debug_msg, (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

    def draw_performance(self, frame, start_time, inference_time):
        # FPS 표시 (오른쪽 상단)
        fps = 1.0 / (time.time() - start_time + 1e-6)
        h, w, _ = frame.shape
        cv2.rectangle(frame, (w-200, 0), (w, 40), (0,0,0), -1)
        cv2.putText(frame, f"FPS: {fps:.1f}", (w-190, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)