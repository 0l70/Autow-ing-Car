## edge02
- 시작점-비행키 도킹 전  

- Start02  
    - x: 108, y: 218
- Goal02  
    - x: 189, y: 202

### 장애물맵 생성
```
julia apps/make_obstaclemap.jl --mask maps/edge02/mask.png --map_yaml maps/my_map.yaml --out_dir maps/edge02 --prefix edge02
```

### 경로 탐색 실행
```
julia apps/path_planning.jl --nodes maps/edge02/node.json --oxoy maps/edge02/edge02_oxoy.json --pairs upper --out_dir maps/edge02/paths --log_dir maps/edge02/planner_logs
```

output path: path_S02_to_G02_20260202_180927.json  

### 시각화
```
python apps/viz_paths.py --path_file maps/edge02/paths/path_S02_to_G02_20260202_180927.json --oxoy_json maps/edge02/edge02_oxoy.json --nodes maps/edge02/node.json --show
```