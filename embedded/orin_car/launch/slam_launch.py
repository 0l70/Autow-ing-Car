import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node
import xacro

def generate_launch_description():
    pkg_name = 'orin_car'
    pkg_share = get_package_share_directory(pkg_name)

    # 파일 경로 설정 (config 폴더 사용)
    xacro_file = os.path.join(pkg_share, 'urdf', 'ackermann_car.urdf.xacro')
    lidar_config_file = os.path.join(pkg_share, 'config', 'X4-Pro.yaml')
    slam_config_file = os.path.join(pkg_share, 'config', 'slam_params.yaml')

    # URDF 파싱
    doc = xacro.process_file(xacro_file)
    robot_description_config = {'robot_description': doc.toxml()}

    # [Node 1] Robot State Publisher
    node_robot_state_publisher = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        output='screen',
        parameters=[robot_description_config]
    )

    # [Node 2] RF2O Laser Odometry
    node_rf2o = Node(
        package='rf2o_laser_odometry',
        executable='rf2o_laser_odometry_node',
        name='rf2o_laser_odometry',
        output='screen',
        parameters=[{
            'laser_scan_topic': '/scan',
            'odom_topic': '/odom_rf2o',
            'publish_tf': True,
            'base_frame_id': 'base_link',
            'odom_frame_id': 'odom',
            'init_pose_from_topic': '',
            'freq': 10.0
        }],
    )

    # [Node 3] YDLidar Driver
    node_ydlidar = Node(
        package='ydlidar_ros2_driver',
        executable='ydlidar_ros2_driver_node',
        output='screen',
        emulate_tty=True,
        parameters=[lidar_config_file],
        namespace='/'
    )

    # [Node 4] SLAM Toolbox
    slam_toolbox_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            os.path.join(get_package_share_directory('slam_toolbox'), 'launch', 'online_async_launch.py')
        ]),
        launch_arguments={
            'use_sim_time': 'false',
            'slam_params_file': slam_config_file
        }.items()
    )

    # [Node 5] Ackermann Driver (모터 제어 노드 추가!)
    # CMakeLists.txt에서 install(PROGRAMS ...)로 설치했으므로 실행 가능
    node_ackermann_driver = Node(
        package='orin_car',
        executable='ackermann_driver.py',
        output='screen'
    )

    return LaunchDescription([
        node_robot_state_publisher,
        node_rf2o,
        node_ydlidar,
        slam_toolbox_launch,
        node_ackermann_driver  # 여기에 추가되었습니다!
    ])
