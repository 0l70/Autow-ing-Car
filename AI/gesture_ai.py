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

        # 좌표 추출
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
        
        # 스테이지 전환 트리거 여부
        is_triggering = False 

        # =================================================================
        # [GLOBAL] RESET (언제든 Stage 0으로 복귀 - 즉시 발동)
        # =================================================================
        l_level = abs(l_wr[1] - l_sh[1]) < 0.2
        r_level = abs(r_wr[1] - r_sh[1]) < 0.2
        l_el_level = abs(l_el[1] - l_sh[1]) < 0.2
        r_el_level = abs(r_el[1] - r_sh[1]) < 0.2
        is_parallel_width = (wrist_dist_x > shoulder_width * 0.5) and (wrist_dist_x < shoulder_width * 1.5)

        if l_level and r_level and l_el_level and r_el_level and is_parallel_width:
            self.stage = 0 
            self.trigger_counter = 0 # 리셋하면 카운터도 초기화
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
            # 트리거: 차렷 자세 (READY)
            is_arms_down = (l_wr[1] > l_sh[1] + 0.3) and (r_wr[1] > r_sh[1] + 0.3)
            is_narrow = wrist_dist_x < shoulder_width * 1.25
            
            if is_arms_down and is_narrow:
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
            
            # 트리거: Approach FAST (팔을 아래로 넓게 벌림)
            l_diff = l_wr[1] - l_sh[1]
            r_diff = r_wr[1] - r_sh[1]
            # [수정] Approach 인식 조건 강화 (확실히 벌려야 함)
            is_fast = (l_diff > 0.25 and r_diff > 0.25) and (wrist_dist_x > shoulder_width * 1.4)
            
            if is_fast:
                is_triggering = True
                current_action = "APPROACHING"
                info_text = "HOLD TO STAGE 2..."
            
            # [일반 동작] Forward / Left / Right
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
            
            # 트리거: STOP (X자 교차)
            is_crossed = r_wr[0] > l_wr[0]
            if is_crossed and (l_wr[1] < l_sh[1] + 0.4):
                is_triggering = True
                current_action = "STOP"
                info_text = "HOLD TO STAGE 3..."
                bg_color = (0, 0, 255)
            
            # [일반 동작] Approaching
            else:
                l_diff = l_wr[1] - l_sh[1]
                r_diff = r_wr[1] - r_sh[1]
                
                # T자 / 수평 (NORMAL)
                if (abs(l_diff) < 0.25 and abs(r_diff) < 0.25):
                    current_action = "APPROACHING"
                    info_text = "SPEED: NORMAL"
                # 팔 올림 (SLOW) - 각도 조건 완화
                elif l_wr[1] < l_sh[1] and r_wr[1] < r_sh[1]:
                     current_action = "APPROACHING"
                     info_text = "SPEED: SLOW"
                # 팔 벌림 (FAST)
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
            
            # 트리거: GRIPPER HOLD (가슴 앞 모으기)
            in_chest = (l_wr[1] > l_sh[1]) and (l_wr[1] < l_hip[1])
            is_hold = in_chest and (wrist_dist_x < shoulder_width * 0.6)
            
            if is_hold:
                is_triggering = True
                current_action = "GRIPPER_HOLD"
                info_text = "HOLD TO STAGE 4..."
            
            # [일반 동작] Cut / Brakes
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
            
            # 트리거: GRIPPER RELEASE (벌리기)
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

        # -------------------------------------------------------------
        # [STATE TRANSITION LOGIC] 게이지 채우기 로직
        # -------------------------------------------------------------
        if is_triggering:
            self.trigger_counter += 1
            progress = self.trigger_counter / self.TRIGGER_LIMIT
            self.draw_loading_bar(frame, progress)
            
            if self.trigger_counter >= self.TRIGGER_LIMIT:
                # 스테이지 변경 및 종료 처리
                if current_action == "EXIT":
                    # main.py에서 종료 신호로 사용
                    pass 
                else:
                    self.stage += 1 # 다음 스테이지로
                    self.trigger_counter = 0 # 카운터 리셋
        else:
            self.trigger_counter = 0 # 트리거 포즈 풀면 바로 리셋

        # 그리기 및 리턴
        self.draw_custom_skeleton(frame, kpts_raw)
        self.draw_status(frame, current_action, info_text, bg_color)
        
        return current_action, frame