import cv2
import numpy as np
from ultralytics import YOLO

class MarshallerAI:
    def __init__(self):
        self.model = YOLO('yolov8n-pose.pt') 
        
        # [상태 관리 변수]
        self.stage = 0 
        
        # [NEW] 스테이지 전환용 타이머 (게이지)
        self.trigger_counter = 0
        self.TRIGGER_LIMIT = 20  # 약 1.0초 동안 유지해야 넘어감 (FPS에 따라 조절)

    def calculate_angle(self, a, b, c):
        """세 점 사이의 각도 계산"""
        a, b, c = np.array(a), np.array(b), np.array(c)
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        if angle > 180.0: angle = 360-angle
        return angle

    def draw_custom_skeleton(self, frame, kpts):
        connections = [(5, 6), (5, 7), (7, 9), (6, 8), (8, 10), (5, 11), (6, 12), (11, 12)]
        for start_idx, end_idx in connections:
            if kpts[start_idx][2] > 0.5 and kpts[end_idx][2] > 0.5:
                x1, y1 = int(kpts[start_idx][0]), int(kpts[start_idx][1])
                x2, y2 = int(kpts[end_idx][0]), int(kpts[end_idx][1])
                cv2.line(frame, (x1, y1), (x2, y2), (0, 255, 0), 3)
        for idx in [0, 5, 6, 7, 8, 9, 10, 11, 12]:
             if kpts[idx][2] > 0.5:
                cv2.circle(frame, (int(kpts[idx][0]), int(kpts[idx][1])), 6, (0, 0, 255), -1)

    def draw_status(self, frame, action, info, color):
        h, w, _ = frame.shape
        box_w, box_h = 300, 90
        x1, y1 = w - box_w, h - box_h
        cv2.rectangle(frame, (x1, y1), (w, h), color, -1)
        cv2.putText(frame, action, (x1+10, y1+35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2, cv2.LINE_AA)
        if info:
            cv2.putText(frame, info, (x1+10, y1+65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 1, cv2.LINE_AA)
        
        # [DEBUG] 스테이지 표시
        cv2.putText(frame, f"STAGE: {self.stage}", (20, h-20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

    def draw_loading_bar(self, frame, progress):
        """화면 중앙에 스테이지 전환 게이지 표시"""
        h, w, _ = frame.shape
        bar_w, bar_h = 400, 30
        x1 = (w - bar_w) // 2
        y1 = h // 2 + 100
        
        # 배경 (회색)
        cv2.rectangle(frame, (x1, y1), (x1 + bar_w, y1 + bar_h), (50, 50, 50), -1)
        
        # 게이지 (초록색)
        fill_w = int(bar_w * progress)
        cv2.rectangle(frame, (x1, y1), (x1 + fill_w, y1 + bar_h), (0, 255, 0), -1)
        
        # 텍스트
        cv2.putText(frame, "HOLD TO NEXT STAGE...", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    def detect_gesture(self, frame):
        h, w, _ = frame.shape
        results = self.model(frame, verbose=False, conf=0.5)
        
        if results[0].keypoints is None or len(results[0].keypoints.data) == 0:
            self.draw_status(frame, "NO HUMAN", "", (100, 100, 100))
            return "IDLE", frame

        kpts_raw = results[0].keypoints.data[0].cpu().numpy()
        def get_norm(idx): return [kpts_raw[idx][0]/w, kpts_raw[idx][1]/h]

        # 필수 키포인트 로드
        nose = get_norm(0) if kpts_raw[0][2] > 0.5 else None
        l_sh, r_sh = get_norm(5), get_norm(6)
        l_el, r_el = get_norm(7), get_norm(8)
        l_wr, r_wr = get_norm(9), get_norm(10)
        l_hip, r_hip = get_norm(11), get_norm(12) 
        
        angle_l = self.calculate_angle(l_sh, l_el, l_wr)
        angle_r = self.calculate_angle(r_sh, r_el, r_wr)
        
        wrist_dist_x = abs(l_wr[0] - r_wr[0])
        shoulder_width = abs(l_sh[0] - r_sh[0])
        
        current_action = "READY"
        info_text = ""
        bg_color = (245, 117, 16)
        
        is_triggering = False 

        # =================================================================
        # [GLOBAL] RESET (열중쉬어 - 각도 조건 강화)
        # =================================================================
        has_arms = (kpts_raw[9][2] > 0.6) and (kpts_raw[10][2] > 0.6)
        has_hips = (kpts_raw[11][2] > 0.6) and (kpts_raw[12][2] > 0.6)
        
        if has_arms and has_hips:
            # 1. 손목 위치: 골반 근처
            l_on_waist = abs(l_wr[1] - l_hip[1]) < 0.2
            r_on_waist = abs(r_wr[1] - r_hip[1]) < 0.2
            
            # 2. 팔꿈치 너비: 어깨보다 넓게 (기존 조건 유지)
            elbow_width = abs(l_el[0] - r_el[0])
            is_elbows_out = elbow_width > shoulder_width * 1.2 # 1.3 -> 1.2로 살짝 완화 (각도로 잡으니까)

            # 3. [핵심] 팔 굽힘 각도 체크 (NEW)
            # 차렷 자세는 보통 160~180도입니다.
            # 열중쉬어는 팔을 굽히므로 각도가 작아야 합니다. (150도 미만)
            is_bent = (angle_l < 150) and (angle_r < 150)

            if l_on_waist and r_on_waist and is_elbows_out and is_bent:
                self.stage = 0 
                self.trigger_counter = 0 
                current_action = "RESET"
                info_text = "BACK TO STAGE 0"
                bg_color = (255, 0, 0)
                
                self.draw_custom_skeleton(frame, kpts_raw)
                self.draw_status(frame, current_action, info_text, bg_color)
                return current_action, frame

        # =================================================================
        # [STAGE 0] FACE ME -> READY
        # =================================================================
        if self.stage == 0:
            is_arms_down = (l_wr[1] > l_sh[1] + 0.3) and (r_wr[1] > r_sh[1] + 0.3)
            # 차렷 자세도 각도로 확실하게 체크 (펴져 있어야 함)
            is_straight = (angle_l > 150) and (angle_r > 150)
            is_narrow = wrist_dist_x < shoulder_width * 1.25
            
            # 손 내림 + 좁음 + 팔 펴짐
            if is_arms_down and is_narrow and is_straight:
                is_triggering = True
                current_action = "READY"
                info_text = "HOLD TO START..."
            else:
                current_action = "FACE_ME"
                info_text = "STAGE 0: WAITING..."
                bg_color = (100, 100, 100)

        # =================================================================
        # [STAGE 1] 이동 -> APPROACH FAST
        # =================================================================
        elif self.stage == 1:
            l_diff = l_wr[1] - l_sh[1]
            r_diff = r_wr[1] - r_sh[1]
            is_fast = (l_diff > 0.25 and r_diff > 0.25) and (wrist_dist_x > shoulder_width * 1.4)
            
            if is_fast:
                is_triggering = True
                current_action = "APPROACHING"
                info_text = "HOLD TO STAGE 2..."
            
            elif abs(l_el[1] - l_sh[1]) < 0.2 and l_wr[1] < l_el[1] and angle_l < 120 and angle_r < 120:
                 current_action = "FORWARD"
            elif abs(l_el[1] - l_sh[1]) < 0.2 and l_wr[1] < l_el[1] and r_wr[1] > r_sh[1] + 0.2:
                 current_action = "TURN_LEFT"
            elif abs(r_el[1] - r_sh[1]) < 0.2 and r_wr[1] < r_el[1] and l_wr[1] > l_sh[1] + 0.2:
                 current_action = "TURN_RIGHT"
            else:
                 current_action = "STAGE_1"
                 info_text = "FWD / LEFT / RIGHT"

        # =================================================================
        # [STAGE 2] 진입 -> STOP
        # =================================================================
        elif self.stage == 2:
            is_crossed = r_wr[0] > l_wr[0]
            if is_crossed and (l_wr[1] < l_sh[1] + 0.4):
                is_triggering = True
                current_action = "STOP"
                info_text = "HOLD TO STAGE 3..."
                bg_color = (0, 0, 255)
            else:
                l_diff = l_wr[1] - l_sh[1]
                r_diff = r_wr[1] - r_sh[1]
                if (abs(l_diff) < 0.25 and abs(r_diff) < 0.25):
                    current_action = "APPROACHING"
                    info_text = "SPEED: NORMAL"
                elif angle_l > 120 and angle_r > 120 and l_wr[1] < l_sh[1]:
                     current_action = "APPROACHING"
                     info_text = "SPEED: SLOW"
                elif (l_diff > 0.25 and r_diff > 0.25) and (wrist_dist_x > shoulder_width * 1.4):
                     current_action = "APPROACHING"
                     info_text = "SPEED: FAST"
                else:
                    current_action = "STAGE_2"
                    info_text = "APPROACH ONLY"

        # =================================================================
        # [STAGE 3] 종료 준비 -> GRIPPER HOLD
        # =================================================================
        elif self.stage == 3:
            in_chest = (l_wr[1] > l_sh[1]) and (l_wr[1] < l_hip[1])
            is_hold = in_chest and (wrist_dist_x < shoulder_width * 0.6)
            
            if is_hold:
                is_triggering = True
                current_action = "GRIPPER_HOLD"
                info_text = "HOLD TO STAGE 4..."
            else:
                neck_top = nose[1] if nose else (l_sh[1] - 0.2)
                margin = shoulder_width * 0.5 
                l_in_throat = (neck_top < l_wr[1] < l_sh[1] + 0.2) and (r_sh[0] - margin < l_wr[0] < l_sh[0] + margin)
                
                if l_in_throat: 
                     current_action = "ENGINE_CUT"
                elif (l_wr[1] < l_sh[1] and r_wr[1] > r_sh[1]) or (r_wr[1] < r_sh[1] and l_wr[1] > l_sh[1]):
                     current_action = "SET_BRAKES"
                else:
                     current_action = "STAGE_3"
                     info_text = "CUT / BRAKES"

        # =================================================================
        # [STAGE 4] 그리퍼 -> EXIT
        # =================================================================
        elif self.stage == 4:
            in_chest = (l_wr[1] > l_sh[1]) and (l_wr[1] < l_hip[1])
            is_release = in_chest and (wrist_dist_x > shoulder_width * 0.8)
            
            if is_release:
                is_triggering = True
                current_action = "EXIT" 
                info_text = "HOLD TO EXIT..."
                bg_color = (0, 0, 0)
            elif wrist_dist_x < shoulder_width * 0.6:
                 current_action = "GRIPPER_HOLD"
            else:
                 current_action = "STAGE_4"
                 info_text = "RELEASE TO EXIT"

        # 게이지 로직
        if is_triggering:
            self.trigger_counter += 1
            progress = self.trigger_counter / self.TRIGGER_LIMIT
            self.draw_loading_bar(frame, progress)
            if self.trigger_counter >= self.TRIGGER_LIMIT:
                if current_action == "EXIT": pass 
                else:
                    self.stage += 1
                    self.trigger_counter = 0 
        else:
            self.trigger_counter = 0 

        self.draw_custom_skeleton(frame, kpts_raw)
        self.draw_status(frame, current_action, info_text, bg_color)
        
        return current_action, frame