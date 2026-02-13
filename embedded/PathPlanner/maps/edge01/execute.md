## edge01
- 시작점-비행키 도킹 전  

- Start01  
    - x: 84, y: 20  
- Goal01  
    - x: 115, y: 206  

### 장애물맵 생성
```
julia apps/make_obstaclemap.jl --mask maps/edge01/mask.png --map_yaml maps/my_map.yaml --out_dir maps/edge01 --prefix edge01
```

### 경로 탐색 실행
```
julia apps/path_planning.jl --nodes maps/edge01/node.json --oxoy maps/edge01/edge01_oxoy.json --pairs upper --out_dir maps/edge01/paths --log_dir maps/edge01/planner_logs
```

output path: path_S01_to_G01_20260202_173003.json  

### 시각화
```
python apps/viz_paths.py --path_file maps/edge01/paths/path_S01_to_G01_20260202_173003.json --oxoy_json maps/edge01/edge01_oxoy.json --nodes maps/edge01/node.json --show
```