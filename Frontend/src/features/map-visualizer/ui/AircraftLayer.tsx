import { useEffect, useRef } from "react";
import { Aircraft, MapMeta } from "@/entities/map/model/types";
import { worldToPixel } from "@/entities/map/lib/coordinate";
import { useAircraftStore } from "@/entities/aircraft";
import { useSmoothAnimation } from "@/features/map-visualizer/lib/useSmoothAnimation";
import { useMapCamera } from "@/features/map-visualizer/ui/MapCanvas";
import { MAP_CONFIG } from "@/features/map-visualizer/model/mapConfig";

interface AircraftLayerProps {
    meta: MapMeta | null;
    mapHeight: number; // 논리적 월드 높이 (고해상도)
    mapWidth: number; // 논리적 월드 너비 (고해상도)
    pixelRatio?: number; // [신규] 고해상도(High-DPI) 지원
    data?: Aircraft[]; // [신규] 외부 데이터 소스 (선택 사항)
    onAircraftClick?: (aircraft: Aircraft) => void;
}

export function AircraftLayer({ meta, mapHeight, mapWidth, pixelRatio = 1, data, onAircraftClick }: AircraftLayerProps) {
    const storeAircraftList = useAircraftStore((state) => state.aircrafts);
    const { scale, offset } = useMapCamera();
    
    // [수정] 데이터 주입 로직
    const displayData = data || storeAircraftList;
    
    // 부드러운 애니메이션 적용 (보간)
    const animatedList = useSmoothAnimation(displayData, MAP_CONFIG.AIRCRAFT.ANIMATION_DURATION);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (!onAircraftClick || !canvasRef.current || !meta) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        
        // 뷰포트 기준 마우스 좌표
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 사용자 클릭 (화면) -> 월드 변환
        // Screen = World * Scale + Offset
        // World = (Screen - Offset) / Scale
        // const worldClickX = (mouseX - offset.x) / scale;
        // const worldClickY = (mouseY - offset.y) / scale;

        // 하지만 worldToPixel은 "픽셀 좌표(논리적 월드)"를 반환합니다.
        // 따라서 공간을 맞춰야 합니다.
        
        for (const ac of animatedList) {
             const pixel = worldToPixel(ac.position, meta, mapHeight);
             
             // Pixel은 논리적 월드 공간에 있습니다.
             // 월드 공간에서 비교할지, 화면 공간에서 비교할지 결정해야 합니다.
             
             // 화면 공간으로 투영(Project)해 보겠습니다.
             const screenX = pixel.x * scale + offset.x;
             const screenY = pixel.y * scale + offset.y;
             
             const distSq = (mouseX - screenX) ** 2 + (mouseY - screenY) ** 2;
             
             if (distSq < MAP_CONFIG.AIRCRAFT.CLICK_RADIUS_SQ) { 
                 onAircraftClick(ac);
                 return;
             }
        }
    };

    useEffect(() => {
        if (!meta || mapHeight === 0 || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const parent = canvas.parentElement;
        if (!parent) return;
        
        const screenW = parent.clientWidth;
        const screenH = parent.clientHeight;
        
        // [신규] High-DPI 스케일링 및 뷰포트 크기
        canvas.width = screenW * pixelRatio;
        canvas.height = screenH * pixelRatio;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        // 변환 초기화
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        
        // DPI 스케일
        ctx.scale(pixelRatio, pixelRatio);
        
        // 카메라 변환 적용
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // 화면 지우기
        // 컨텍스트가 변환되었으므로, (0,0)에서 지우면 World(0,0)부터 지워집니다.
        // 화면 전체를 지우려면 변환을 잠시 풀고 지워야 합니다.
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const { SIZE, FONT, STATUS_COLORS } = MAP_CONFIG.AIRCRAFT;

        animatedList.forEach(ac => {
            const pixel = worldToPixel(ac.position, meta, mapHeight);
            
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // 회전 보정:
            ctx.rotate(-ac.position.r); 

            // 바디 그리기 (스케일 불변? 아니요, 지금은 맵과 함께 스케일되도록 둡니다.)
            // 하지만 고해상도(5배) 상태에서 기본 5px 크기는 너무 작게 보일 수 있습니다.
            // 논리적 픽셀이 5배 더 조밀하기 때문입니다.
            // Drawing 5px at scale 1.0 (Zoomed Out to fit screen) -> 
            // mapHeight=10000. Screen=1000. Scale=0.1.
            // 5px * 0.1 = 0.5px. 너무 작습니다!
            
            // 해결책: 아이콘 크기를 고정하기 위해 역(Inverse) 스케일을 적용합니다.
            const fixedSizeScale = 1 / scale; 
            
            ctx.scale(fixedSizeScale, fixedSizeScale);
            
            let color = STATUS_COLORS[ac.status] || '#FFFFFF';
            let blur = 10;
            const labelText = ac.callsign;

            // [ATC 시각화] 견인 상태 = 활성 광채
            if (ac.isLoaded) {
                color = MAP_CONFIG.AIRCRAFT.COLOR.DEFAULT_BODY; // 바디는 흰색
                ctx.shadowColor = MAP_CONFIG.AIRCRAFT.COLOR.TOWING_GLOW; // 네온 그린 광채
                blur = 30; // 강한 펄스
            } else {
                ctx.shadowColor = color;
            }

            ctx.fillStyle = color;
            ctx.shadowBlur = blur;
            
            ctx.beginPath();
            // 동쪽(0도)을 가리키는 삼각형
            // SIZE.LENGTH = 10 (Nose)
            // SIZE.WING_SPAN_HALF = 7.5 (Width)
            // SIZE.TAIL_INDENT = 4 (Back)
            // SIZE.WING_WIDTH = 6 (Wing Thickness/Angle)
            
            ctx.moveTo(SIZE.LENGTH, 0);      
            ctx.lineTo(-SIZE.WING_SPAN_HALF, SIZE.WING_WIDTH);  
            ctx.lineTo(-SIZE.TAIL_INDENT, 0);     
            ctx.lineTo(-SIZE.WING_SPAN_HALF, -SIZE.WING_WIDTH); 
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0; // 초기화
            ctx.restore();
            
            // 라벨 (회전하지 않음, HUD 배경)
            ctx.save();
            ctx.translate(pixel.x, pixel.y);
            
            // 고정 크기 라벨
            ctx.scale(fixedSizeScale, fixedSizeScale);

            // 텍스트 설정
            ctx.font = `${FONT.WEIGHT} ${FONT.SIZE}px ${FONT.FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top'; 
            
            // 텍스트 (대비를 위한 진한 그림자/스트로크)
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;
            ctx.lineWidth = FONT.STROKE_WIDTH;
            ctx.strokeStyle = FONT.STROKE_COLOR;
            ctx.strokeText(labelText, 0, FONT.SIZE); 

            ctx.fillStyle = FONT.COLOR;
            ctx.fillText(labelText, 0, FONT.SIZE); 

            ctx.restore();
        });

    }, [animatedList, meta, mapHeight, pixelRatio, scale, offset]);

    return (
        <canvas 
            ref={canvasRef}
            className="absolute inset-0 cursor-pointer pointer-events-auto"
            style={{ zIndex: MAP_CONFIG.Z_INDEX.AIRCRAFT_LAYER }}
            onClick={handleClick}
        />
    );
}
