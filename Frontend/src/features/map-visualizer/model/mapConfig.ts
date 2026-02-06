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
            DEFAULT: '#f97316', // Orange (기본 경로)
            ACTIVE: '#FFFFFF',  // White (활성 경로 코어)
        },
        EDGE: {
            WIDTH: {
                GLOW: 5,           // 기본 발광 두께
                CORE: 1.5,         // 기본 코어 두께
                ACTIVE_GLOW: 12,   // 활성 경로 발광 두께
                ACTIVE_BEAM: 4,    // 활성 경로 빔 두께
                ACTIVE_CORE: 2,    // 활성 경로 코어 두께
            },
            CORNER_RADIUS: 20, // 경로 모서리 둥글기 (Fillet Radius)
        },
        NODE: {
            RADIUS: {
                NORMAL_GLOW: 4,    // 일반 노드 발광 반경
                NORMAL_CORE: 1.5,  // 일반 노드 코어 반경
                SELECTED_GLOW: 8,  // 선택된 노드 발광 반경
                SELECTED_CORE: 6,  // 선택된 노드 코어 반경
            }
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
    }
} as const;
