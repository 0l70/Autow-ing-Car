import cv2
import numpy as np
import math

class DockingAI:
    def __init__(self):
        # ---------------------------------------------------------
        # [1] 사용자 설정 (반드시 확인!)
        # 실제 마커의 한 변의 길이 (단위: cm)
        # 예: A4에 크게 뽑았으면 10~15cm, 작으면 5cm 정도 됩니다. 자로 재보세요.
        self.MARKER_SIZE = 5.0  
        
        # 사용할 딕셔너리와 ID (아까 확인한 5x5, ID 15)
        self.target_dict = cv2.aruco.DICT_5X5_100
        self.target_id = 15 
        # ---------------------------------------------------------

        # ArUco 설정
        self.aruco_dict = cv2.aruco.getPredefinedDictionary(self.target_dict)
        self.parameters = cv2.aruco.DetectorParameters()
        # [추가] 코너 정밀 보정 옵션 켜기 (SUBPIX 모드)
        # 마커 테두리를 픽셀 소수점 단위로 미세 조정해서 떨림을 줄여줌
        self.parameters.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX 
        
        self.detector = cv2.aruco.ArucoDetector(self.aruco_dict, self.parameters)

        # [2] 가상 카메라 매트릭스 설정 (캘리브레이션 없이 거리 계산용)
        # 해상도가 640x480이라고 가정
        self.width = 640
        self.height = 480
        
        # 초점거리(focal length) 근사값: 보통 웹캠은 가로 해상도와 비슷함
        focal_length = 640 
        center_x = self.width / 2
        center_y = self.height / 2

        self.camera_matrix = np.array([
            [focal_length, 0, center_x],
            [0, focal_length, center_y],
            [0, 0, 1]
        ], dtype=np.float32)

        self.dist_coeffs = np.zeros((4, 1)) # 왜곡 계수 (0으로 가정)

        # 3D 좌표 기준점 (마커의 4개 모서리)
        # (왼쪽위, 오른쪽위, 오른쪽아래, 왼쪽아래)
        ms = self.MARKER_SIZE / 2
        self.obj_points = np.array([
            [-ms, ms, 0],
            [ms, ms, 0],
            [ms, -ms, 0],
            [-ms, -ms, 0]
        ], dtype=np.float32)

    def process(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        corners, ids, rejected = self.detector.detectMarkers(gray)
        
        data = {
            "found": False,
            "dist_cm": 0.0,    # 실제 거리
            "yaw_deg": 0.0,    # 마커가 틀어진 각도 (좌우 회전)
            "error_x": 0.0,    # 화면 중심 오차
            "center": (0, 0)
        }

        if ids is not None and self.target_id in ids:
            idx = np.where(ids == self.target_id)[0][0]
            target_corners = corners[idx][0] # (4, 2)

            # 1. Pose Estimation (3D 위치 추정)
            # 2D 이미지 좌표(target_corners)와 3D 실제 좌표(obj_points)를 매칭
            success, rvec, tvec = cv2.solvePnP(
                self.obj_points, 
                target_corners, 
                self.camera_matrix, 
                self.dist_coeffs
            )
            
            if success:
                # 2. 거리 계산 (단위: cm)
                # tvec[2]가 Z축 거리(깊이)입니다.
                # 정확히는 3차원 유클리드 거리지만, 정면에서는 Z값과 거의 같음
                distance = math.sqrt(tvec[0]**2 + tvec[1]**2 + tvec[2]**2)
                
                # 3. 각도(Yaw) 계산 - 로드리게스 변환
                # 회전 벡터(rvec) -> 회전 행렬 -> 오일러 각도
                rmat, _ = cv2.Rodrigues(rvec)
                
                # Yaw (y축 기준 회전) 계산: 마커가 나를 정면으로 보고 있는지?
                # 마커 평면의 법선 벡터를 이용해 계산
                yaw = math.atan2(rmat[1, 0], rmat[0, 0]) * (180.0 / math.pi)

                # 데이터 저장
                data["found"] = True
                data["dist_cm"] = distance
                data["yaw_deg"] = yaw
                
                # 중심점 계산
                cx = int(target_corners[:, 0].mean())
                cy = int(target_corners[:, 1].mean())
                data["center"] = (cx, cy)
                data["error_x"] = cx - (self.width / 2)

                # --- [시각화] ---
                # (1) 마커 테두리
                cv2.aruco.drawDetectedMarkers(frame, corners, ids)
                
                # (2) 3D 축 그리기 (X:빨강, Y:초록, Z:파랑)
                # 마커 위에 3차원 화살표가 생깁니다!
                cv2.drawFrameAxes(frame, self.camera_matrix, self.dist_coeffs, rvec, tvec, self.MARKER_SIZE)

                # (3) 정보 텍스트 출력
                info_text = f"Dist: {distance:.1f}cm | Yaw: {yaw:.1f}deg"
                cv2.putText(frame, info_text, (cx - 40, cy - 20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                
                # 화면 하단에도 고정 출력
                cv2.putText(frame, f"[DOCKING] Dist: {distance:.1f}cm / Yaw: {yaw:.1f}", (20, 450), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        return data, frame