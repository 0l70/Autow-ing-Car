/**
 * 지도 시각화 설정 (Map Visualization Configuration)
 * 
 * 모든 지도 관련 상수(해상도, 색상, 두께, 크기 등)를 이곳에서 통합 관리합니다.
 * 컴포넌트 간 일관된 스타일을 유지하고 유지보수를 용이하게 합니다.
 */
export const MAP_CONFIG = {
    // 1. 해상도 및 스케일링 (Resolution & Scaling)
    RESOLUTION: {
        BASE_SCALE_FACTOR: 5,   // 5배 해상도 (Virtual Scale) - 가상 좌표계 확대 비율
        VIRTUAL_RESOLUTION: 0.01, // 가상 해상도 (0.01m/pixel) - 목표 정밀도
    },

    // 2. 뷰포트 및 패딩 (Viewport & Layout)
    VIEWPORT: {
        EXPANSION_RATIO: 0.2,   // 지도 외곽 확장 비율 (Map Padding)
        SIDE_RATIO: 0.1,        // 오리진 이동 비율
        PADDING_SCALE: 0.05,    // 자동 포커스 시 노드 주변 여백 (5%)
        MIN_PADDING_METERS: 2,  // 최소 여백 (미터)
    },

    // 3. 그리드 스타일 (Grid Styling)
    GRID: {
        MAJOR_INTERVAL: 1.5,
        MINOR_INTERVAL: 0.5,
        MAJOR_WIDTH: 0.3,
        MINOR_WIDTH: 0.1,
        COLOR: {
            MAJOR: 'rgba(0, 255, 255, 0.2)', // Cyan Low Opacity
            MINOR: 'rgba(255, 255, 255, 0.3)', // White Low Opacity
        }
    },

    // 4. 그래프 레이어 스타일 (Graph Layer Colors & Dimensions)
    GRAPH: {
        COLOR: {
            DEFAULT: '#1e293b', // Slate-800 (Dark Road Core)
            OUTLINE: '#cbd5e1', // Slate-300 (Crisp Border Line)
            NEON_GLOW: 'rgba(148, 163, 184, 0.5)', // Slate-400 with opacity (Soft Outer Glow)
            ACTIVE: '#FFD0B0',  // Light Neon Orange (활성 노드 내부 - 가시성 위해 채도 높임)
            ACTIVE_BORDER: '#FF6D28', // Neon Orange (활성 노드 테두리)
            // [ATC] Controller Preview Colors
            ATC_HIGHLIGHT: '#FF6D28',       // 네온 주황색 (밝음)
            ATC_GLOW: 'rgba(255, 109, 40, 0.6)', // 네온 주황색 발광 (은은함)
            NODE: '#334155',    // Slate-700 (Dark Gray Fill)
            NODE_BORDER: '#94a3b8', // Slate-400 (Light Gray Border)
            NODE_TYPE: {
                WAYPOINT: '#334155',      // Slate-700 (Default)
                CHARGER: '#475569',       // Slate-600
                GATE: '#1e293b',          // Slate-800
                RUNWAY: '#0f172a',        // Slate-900
                INTERSECTION: '#334155',  // Slate-700
                NODE: '#334155',          // Slate-700
                PARKING_LOT: '#475569',   // Slate-600
            }
        },
        EDGE: {
            WIDTH: {
                //일반도로
                GLOW: 10,          // 최하단 발광 (가장 넓음)
                CORE: 4,           // 최상단 도로
                OUTLINE: 5,        // 중간 테두리 (코어보다 아주 약간 넓음 - 얇은 선)
                //활성화 도로
                ATC_ROUTE: 3,      // 미리보기 경로 두께 (중심선)
                ATC_ROUTE_GLOW: 3, // 미리보기 경로 발광 두께 (테두리 빛)
            },
            CORNER_RADIUS: 20, // 경로 모서리 둥글기 (Fillet Radius)
        },
        NODE: {
            RADIUS: {
                NORMAL_GLOW: 0,    // 노드 발광 제거
                NORMAL_CORE: 2.5,  // 일반 노드 크기
                SELECTED_GLOW: 0,  // 선택된 노드 발광
                SELECTED_CORE: 2.5,  // 선택된 노드 크기
            },
            STROKE_WIDTH: 1.5 // [NEW] 노드 테두리 두께
        }
    },

    // 5. 항공기/차량 레이어 스타일 (Aircraft Layer)
    AIRCRAFT: {
        SIZE: {
            // 그리기 좌표 (Canvas MoveTo/LineTo 기준)
            LENGTH: 10,       // 기수 길이 (앞으로 튀어나온 정도)
            WING_SPAN_HALF: 7.5, // 날개 반폭 (좌우 7.5씩, 전체 15)
            TAIL_INDENT: 4,   // 꼬리 부분 파임 깊이
        },
        ANIMATION_DURATION: 300, // 이동 애니메이션 시간 (ms)
        CLICK_RADIUS_SQ: 400,    // 클릭 인식 반경 제곱 (20px * 20px)
        
        FONT: {
            SIZE: 12,
            WEIGHT: 'bold',
            FAMILY: 'sans-serif',
            COLOR: '#FFFFFF',
            STROKE_COLOR: 'rgba(0,0,0,0.8)',
            STROKE_WIDTH: 3,
        },
        
        // 상태별 색상 (Status Colors)
        STATUS_COLORS: {
            IDLE: '#FFA500',             // 주황색: 대기 중
            MOVING_TO_GATE: '#00FF00',   // 초록색: 작업 이동 중
            DOCKING: '#00FFFF',          // 시안색: 정밀 조작 중
            TOWING: '#D946EF',           // 자주색: 견인 중
            UNDOCKING: '#00FFFF',        // 시안색: 정밀 조작 중
            WAITING_FOR_RETURN: '#FACC15', // 노란색: 대기
            RETURNING: '#3B82F6',        // 파란색: 복귀 중
            STOP: '#FF0000',             // 빨간색: 비상/정지
            ERROR: '#FF0000'             // 빨간색: 에러
        } as Record<string, string>
    },

    // 6. 레이어 Z-Index (Layer Stacking Order)
    Z_INDEX: {
        BASE_MAP: 0,
        GRAPH_LAYER: 30,      // [Deprecated] Use granular layers below
        LAYER_ROADS: 30,      // 도로 (가장 아래)
        LAYER_ATC_PATH: 31,   // 관제 경로 
        LAYER_NODES: 32,      // 노드
        LAYER_ACTIVE_NODE: 33,// [Highlighted] 활성 노드
        GRID_LAYER: 40,       // 그리드
        AIRCRAFT_LAYER: 50,   // 항공기 및 차량 레이어 (가장 상위)
        UI_OVERLAY: 100       // UI 컨트롤 등
    }
} as const;
