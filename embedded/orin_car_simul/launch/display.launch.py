import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node
import xacro

def generate_launch_description():
    pkg_name = 'orin_car'
    
    # 확인하고 싶은 xacro 파일명 (여기서는 robot_4.xacro)
    file_subpath = 'urdf/robot.xacro'

    # Xacro 파일 경로 설정 및 변환
    pkg_path = os.path.join(get_package_share_directory(pkg_name))
    xacro_file = os.path.join(pkg_path, file_subpath)
    robot_description = xacro.process_file(xacro_file).toxml()

    return LaunchDescription([
        # 1. 로봇 상태 퍼블리셔 (TF 변환)
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            output='screen',
            parameters=[{'robot_description': robot_description}]
        ),
        
        # 2. 관절 상태 퍼블리셔 GUI (바퀴 등을 수동으로 움직여 볼 수 있음)
        Node(
            package='joint_state_publisher_gui',
            executable='joint_state_publisher_gui',
            output='screen'
        ),
        
        # 3. RViz2 실행
        Node(
            package='rviz2',
            executable='rviz2',
            output='screen'
        )
    ])
