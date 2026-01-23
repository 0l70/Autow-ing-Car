import cv2
import mediapipe as mp
import numpy as np
import math

class MarshallerAI:
    def __init__(self):
        # MediaPipe Pose 모델 초기화
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
        self.status = "IDLE"
        self.is_finished = False # 도킹 완료 상태 플래그

    def calculate_angle(self, a, b, c):
        """세 점 사이의 각도 계산"""
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        if angle > 180.0: angle = 360-angle
        return angle

    def detect_gesture(self, frame):
        # 이미 완료된 상태면 도킹 터미널 화면 유지
        if self.is_finished:
            cv2.rectangle(frame, (0,0), (frame.shape[1], frame.shape[0]), (0,0,0), -1)
            cv2.putText(frame, "DOCKING TERMINAL", (50, 200), 
                       cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 5, cv2.LINE_AA)
            cv2.putText(frame, "SYSTEM STANDBY", (100, 300), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (200, 200, 200), 2, cv2.LINE_AA)
            return "FINISHED", frame

        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = self.pose.process(image)
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        current_action = "IDLE"
        info_text = ""

        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark

            # 1. 주요 관절 좌표 추출
            # 왼쪽
            l_sh = [landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                    landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
            l_el = [landmarks[self.mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                    landmarks[self.mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
            l_wr = [landmarks[self.mp_pose.PoseLandmark.LEFT_WRIST.value].x,
                    landmarks[self.mp_pose.PoseLandmark.LEFT_WRIST.value].y]
            # 오른쪽
            r_sh = [landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                    landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
            r_el = [landmarks[self.mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                    landmarks[self.mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
            r_wr = [landmarks[self.mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                    landmarks[self.mp_pose.PoseLandmark.RIGHT_WRIST.value].y]

            # 각도 및 거리 계산
            angle_l = self.calculate_angle(l_sh, l_el, l_wr)
            angle_r = self.calculate_angle(r_sh, r_el, r_wr)
            wrist_dist = abs(l_wr[0] - r_wr[0])

            # =========================================================
            # 제스처 판단 로직 (우선순위: STOP/BRAKE/CUT > MOTION)
            # =========================================================

            # [1] STOP: 팔이 X자로 교차 (최우선)
            # 조건: 손이 어깨보다 높고, 손목이 겹치거나 매우 가까움
            if (l_wr[1] < l_sh[1] and r_wr[1] < r_sh[1]) and \
               (wrist_dist < 0.15 or l_wr[0] < r_wr[0]):
                current_action = "STOP"

            # [2] ENGINE_CUT (종료 동작): 목 긋기
            # 조건: 한 손은 아래, 다른 한 손은 반대쪽 어깨 근처(목)로 이동
            # (왼손이 올라와서 오른쪽 어깨 근처로 감 OR 오른손이 올라와서 왼쪽 어깨 근처로 감)
            elif (l_wr[1] < l_sh[1] + 0.15 and r_wr[1] > r_sh[1] and l_wr[0] < r_sh[0]) or \
                 (r_wr[1] < r_sh[1] + 0.15 and l_wr[1] > l_sh[1] and r_wr[0] > l_sh[0]):
                 
                 current_action = "ENGINE_CUT"
                 self.is_finished = True # 완료 화면으로 전환

            # [3] SET_BRAKES: 한 팔은 위(STOP위치), 한 팔은 아래로 내림
            # 조건: 한 손은 어깨 위, 한 손은 어깨 아래
            elif (l_wr[1] < l_sh[1] and r_wr[1] > r_sh[1]) or \
                 (r_wr[1] < r_sh[1] and l_wr[1] > l_sh[1]):
                current_action = "SET_BRAKES"

            # [4] APPROACHING: 팔을 쭉 펴서 머리 위로 (Y자 형태)
            # 조건: 손이 어깨보다 높고, 팔꿈치가 펴져 있음(>130)
            elif (l_wr[1] < l_sh[1] and r_wr[1] < r_sh[1]) and \
                 (angle_l > 130 and angle_r > 130):
                current_action = "APPROACHING"
                # 손 간격에 따른 속도 피드백
                if wrist_dist > 0.5: info_text = "SPEED: FAST"
                elif wrist_dist > 0.2: info_text = "SPEED: SLOW"
                else: info_text = "PREPARE STOP"

            # [5] FACE_ME: 양팔을 수평으로 쭉 뻗음 (T자)
            # 조건: 손 높이와 어깨 높이가 비슷, 팔꿈치 펴짐
            elif abs(l_wr[1] - l_sh[1]) < 0.2 and abs(r_wr[1] - r_sh[1]) < 0.2 and \
                 angle_l > 140 and angle_r > 140:
                current_action = "FACE_ME"

            # [6] FORWARD: T자에서 팔꿈치만 굽힘 (ㄴ자, W자 모양)
            # 조건: 어깨-팔꿈치는 수평 유지, 팔꿈치 각도는 90도 근처
            elif abs(l_el[1] - l_sh[1]) < 0.2 and abs(r_el[1] - r_sh[1]) < 0.2 and \
                 angle_l < 120 and angle_r < 120:
                current_action = "FORWARD"

            else:
                current_action = "IDLE"

            # 뼈대 그리기
            self.mp_drawing.draw_landmarks(
                image, results.pose_landmarks, self.mp_pose.POSE_CONNECTIONS)

        self.status = current_action
        
        # 정보창 그리기
        h, w, _ = image.shape
        x1, y1 = w - 280, h - 80
        cv2.rectangle(image, (x1, y1), (w, h), (245, 117, 16), -1)
        cv2.putText(image, current_action, (x1+10, y1+35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
        if info_text:
            cv2.putText(image, info_text, (x1+10, y1+65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 1)

        return current_action, image