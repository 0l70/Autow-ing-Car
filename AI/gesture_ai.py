import cv2
import numpy as np
from ultralytics import YOLO

class MarshallerAI:
    def __init__(self):
        # YOLOv8 Pose 모델 로드
        self.model = YOLO('yolov8n-pose.pt') 
        self.status = "IDLE"

    def calculate_angle(self, a, b, c):
        """세 점 사이의 각도 계산"""
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        if angle > 180.0: angle = 360-angle
        return angle

    def draw_custom_skeleton(self, frame, kpts):
        """상반신 커스텀 시각화"""
        connections = [(5, 6), (5, 7), (7, 9), (6, 8), (8, 10)]
        line_color = (0, 255, 0)
        joint_color = (0, 0, 255)
        
        for start_idx, end_idx in connections:
            if kpts[start_idx][2] > 0.5 and kpts[end_idx][2] > 0.5:
                x1, y1 = int(kpts[start_idx][0]), int(kpts[start_idx][1])
                x2, y2 = int(kpts[end_idx][0]), int(kpts[end_idx][1])
                cv2.line(frame, (x1, y1), (x2, y2), line_color, 3)

        relevant_indices = [0, 5, 6, 7, 8, 9, 10]
        for idx in relevant_indices:
             if kpts[idx][2] > 0.5:
                cx, cy = int(kpts[idx][0]), int(kpts[idx][1])
                cv2.circle(frame, (cx, cy), 8, (255, 255, 255), -1)
                cv2.circle(frame, (cx, cy), 6, joint_color, -1)

    def detect_gesture(self, frame):
        h, w, _ = frame.shape
        results = self.model(frame, verbose=False, conf=0.5)
        
        current_action = "IDLE"
        info_text = ""
        
        if results[0].keypoints is not None and len(results[0].keypoints.data) > 0:
            kpts_raw = results[0].keypoints.data[0].cpu().numpy()
            
            # 어깨 감지 확인
            if kpts_raw[5][2] > 0.5 and kpts_raw[6][2] > 0.5:
                
                # 좌표 정규화 함수
                def get_norm_point(idx):
                    return [kpts_raw[idx][0] / w, kpts_raw[idx][1] / h]

                l_sh = get_norm_point(5)  # Left Shoulder
                r_sh = get_norm_point(6)  # Right Shoulder
                l_el = get_norm_point(7)  # Left Elbow
                r_el = get_norm_point(8)  # Right Elbow
                l_wr = get_norm_point(9)  # Left Wrist
                r_wr = get_norm_point(10) # Right Wrist

                angle_l = self.calculate_angle(l_sh, l_el, l_wr)
                angle_r = self.calculate_angle(r_sh, r_el, r_wr)
                wrist_dist = abs(l_wr[0] - r_wr[0])

                # ----------------------------------------------------------------
                # 제스처 판단 로직
                # ----------------------------------------------------------------

                # [1] STOP: 확실한 교차 (Cross)
                # 좌표계: 왼쪽 손목(9)이 화면상 오른쪽, 오른쪽 손목(10)이 화면상 왼쪽
                # 정상 상태: l_wr[0] > r_wr[0] (사람 기준 왼쪽이 화면 오른쪽이니까)
                # 교차 상태: l_wr[0] < r_wr[0] (좌우 반전됨) -> STOP
                # 또는 거리가 극도로 가까우면서(0.05 미만) 손 높이가 비슷할 때
                
                # 먼저 손목이 교차되었는지 확인 (좌표 역전 현상)
                # 사람 기준 왼손(l_wr)은 화면상 오른쪽에 있어야 함 (x값이 커야 함)
                # 사람 기준 오른손(r_wr)은 화면상 왼쪽에 있어야 함 (x값이 작아야 함)
                # 즉, l_wr[0] < r_wr[0] 이면 팔이 꼬인 것임 -> STOP
                is_crossed = l_wr[0] < r_wr[0] 

                if is_crossed: 
                    current_action = "STOP"

                # [2] ENGINE_CUT (목 긋기)
                elif (l_wr[1] < l_sh[1] + 0.15 and r_wr[1] > r_sh[1] and l_wr[0] < r_sh[0]) or \
                     (r_wr[1] < r_sh[1] + 0.15 and l_wr[1] > l_sh[1] and r_wr[0] > l_sh[0]):
                     current_action = "ENGINE_CUT"

                # [3] SET_BRAKES (한 손 위, 한 손 아래)
                elif (l_wr[1] < l_sh[1] and r_wr[1] > r_sh[1]) or \
                     (r_wr[1] < r_sh[1] and l_wr[1] > l_sh[1]):
                    current_action = "SET_BRAKES"

                # [4] FORWARD (오라고 손짓 + 흔들기 허용)
                # 조건: 팔꿈치가 어깨 높이 근처(수평) + 손이 팔꿈치보다 위에 있음
                # 각도 제한을 완화하여 손을 흔들어도 인식되게 함
                elif abs(l_el[1] - l_sh[1]) < 0.2 and abs(r_el[1] - r_sh[1]) < 0.2 and \
                     l_wr[1] < l_el[1] and r_wr[1] < r_el[1]:
                    current_action = "FORWARD"

                # [5] APPROACHING (진입 / 속도 조절)
                # 조건: 팔을 펴고(Straight) + 겨드랑이가 30도 이상 벌어짐 (Low V ~ High V)
                # STOP과 구분: 위에서 Cross 체크를 통과했으므로, 여기선 '안 겹친 상태'임
                elif (angle_l > 130 and angle_r > 130):
                    # 손이 허리(또는 어깨 아래 일정 수준)보다는 높아야 바닥이랑 구분됨
                    # 어깨보다 조금 아래(Low V)까지 허용 (l_sh[1] + 0.3)
                    if l_wr[1] < l_sh[1] + 0.4 and r_wr[1] < r_sh[1] + 0.4:
                        current_action = "APPROACHING"
                        
                        # 속도 가이드 (거리 기반)
                        if wrist_dist > 0.6: 
                            info_text = "SPEED: FAST"
                        elif wrist_dist > 0.15: # 0.15 ~ 0.6 사이
                            info_text = "SPEED: SLOW"
                        else: # 0.15 이하 (거의 붙음)
                            info_text = "PREPARE STOP"
                
                # [6] FACE_ME (T자 수평)
                # Approaching이랑 겹칠 수 있는데, 이건 '수평'이 매우 중요
                elif abs(l_wr[1] - l_sh[1]) < 0.15 and abs(r_wr[1] - r_sh[1]) < 0.15 and \
                     angle_l > 150 and angle_r > 150:
                    current_action = "FACE_ME"

                else:
                    current_action = "IDLE"
            
            self.draw_custom_skeleton(frame, kpts_raw)

        self.status = current_action
        
        box_w, box_h = 280, 80
        x1, y1 = w - box_w, h - box_h
        cv2.rectangle(frame, (x1, y1), (w, h), (245, 117, 16), -1)
        cv2.putText(frame, current_action, (x1+10, y1+35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2, cv2.LINE_AA)
        if info_text:
            cv2.putText(frame, info_text, (x1+10, y1+65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 1, cv2.LINE_AA)

        return current_action, frame