import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node

def generate_launch_description():
    package_name = "orin_car"

    # [경로 확인] 맵 파일 경로
    map_file_path = os.path.join(os.path.expanduser('~'), 'maps', 'my_map.yaml')

    # [파라미터] 커스텀 파라미터 파일 경로
    params_file_path = os.path.join(get_package_share_directory(package_name), 'config', 'nav2_params.yaml')

    rsp = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            [os.path.join(get_package_share_directory(package_name), "launch", "robot.launch.py")]
        ),
        launch_arguments={"use_sim_time": "true"}.items(),
    )

    world_path = os.path.join(get_package_share_directory(package_name), 'worlds', 'obstacle.world')
    
    gazebo = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            [os.path.join(get_package_share_directory("gazebo_ros"), "launch", "gazebo.launch.py")]
        ),
        launch_arguments={'world': world_path}.items(),
    )

    spawn_entity = Node(
        package="gazebo_ros",
        executable="spawn_entity.py",
        arguments=["-topic", "robot_description", "-entity", "my_bot", "-z", "0.5"],
        output="screen",
    )

    joint_state_publisher = Node(
        package='joint_state_publisher',
        executable='joint_state_publisher',
        name='joint_state_publisher',
        parameters=[{'use_sim_time': True}],
    )

    # [수정 포인트 1] RF2O 노드 제거 (주석 처리)
    # 가제보 플러그인에서 odom을 뿌려주므로(이전 단계 설정) 이것을 끄는 것이 맞습니다.
    # rf2o_node = Node(
    #    package='rf2o_laser_odometry',
    #    executable='rf2o_laser_odometry_node',
    #    name='rf2o_laser_odometry',
    #    output='screen',
    #    parameters=[{
    #        'laser_scan_topic': '/scan',
    #        'odom_topic': '/odom_rf2o',
    #        'publish_tf': True,
    #        'base_frame_id': 'base_link',
    #        'odom_frame_id': 'odom',
    #        'init_pose_from_topic': '',
    #        'freq': 40.0,
    #        'use_sim_time': True
    #    }],
    # )

    # [수정 포인트 2] Nav2 실행 시 autostart 옵션 추가
    nav2 = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            os.path.join(get_package_share_directory('nav2_bringup'), 'launch', 'bringup_launch.py')
        ]),
        launch_arguments={
            'map': map_file_path,
            'use_sim_time': 'true',
            'params_file': params_file_path,
            'autostart': 'True'  # [중요] 이 옵션이 있어야 맵 서버가 'Active' 상태가 되어 맵을 뿌립니다.
        }.items()
    )

    return LaunchDescription(
        [
            rsp,
            joint_state_publisher,
            gazebo,
            spawn_entity,
            # rf2o_node, # 제거됨
            nav2
        ]
    )
