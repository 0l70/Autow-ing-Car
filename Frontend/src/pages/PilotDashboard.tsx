import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Radio, Map as MapIcon, CheckCircle } from 'lucide-react';
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import useLongPress from "@/shared/lib/useLongPress";
import { INITIAL_LOGS, VEHICLE_STATUS, NAVIGATION_DATA } from '@/features/dashboard/MockData';

// --- Sub-components ---
import { PilotTimeline } from "@/features/dashboard/pilot-ui/PilotTimeline";
import { PilotCommandButtons } from "@/features/dashboard/pilot-ui/PilotCommandButtons";
import { PilotTugStatus } from "@/features/dashboard/pilot-ui/PilotTugStatus";
import { PilotFlightInfo } from "@/features/dashboard/pilot-ui/PilotFlightInfo";
import { PilotSafetyControls } from "@/features/dashboard/pilot-ui/PilotSafetyControls";

// --- Types ---
import { MoveState, ConnectionState } from "@/features/dashboard/model/dashboardTypes";

// --- Map Integration ---
import { MapCanvas } from "@/widgets/map-panel/MapCanvas";
import { GraphInteractionLayer } from "@/features/map-editor/ui/GraphInteractionLayer";
import { CameraFeed } from "@/features/dashboard/ui/CameraFeed";
import { cn } from "@/shared/lib/utils";

import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, Aircraft } from "@/entities/map/model/types";
import { MOCK_EDGES, MOCK_NODES, MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { useMockAircraftMqtt } from "@/entities/map/lib/mockAircraft";
import { useTelemetrySocket } from "@/features/map-visualizer/model/useTelemetrySocket";

export function PilotDashboard() {
    // --- State 관리 ---
    const [logs, setLogs] = useState(INITIAL_LOGS);
    const [moveState, setMoveState] = useState<MoveState>('stopped');
    const [connState, setConnState] = useState<ConnectionState>('disconnected');
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [isCamEnabled, setIsCamEnabled] = useState(false);

    // --- 지도 상태 관리 ---
    const { loadGraph, setAircrafts, mapWidth: storeMapWidth, mapHeight: storeMapHeight } = useGraphStore();
    const [mapMeta, setMapMeta] = useState<MapMeta | null>(null);
    const [mapHeight, setMapHeight] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [currentMissionId, setCurrentMissionId] = useState<string | null>(null);

    // --- Refs ---
    const logEndRef = useRef<HTMLDivElement>(null);

    // --- 데이터 소스 ---
    // 관제사와 동일한 Mock 데이터 소스 사용 (추후 WebSocket으로 대체)
    // 관제사와 동일한 Mock 데이터 소스 사용 (추후 WebSocket으로 대체)
    const mockData = useMockAircraftMqtt();
    // WebSocket Hook
    const { request } = useTelemetrySocket();

    useEffect(() => {
        setAircrafts(mockData);
    }, [mockData, setAircrafts]);

    useEffect(() => {
        // Only load graph if not already populated (or you might want to force sync)
        // For now, Pilot view acts as a passive consumer mainly.
        // loadGraph(MOCK_NODES, MOCK_EDGES); 
    }, [loadGraph]);

    // ... (Protocols) ...

    const handleMapLoad = useCallback((info: { meta: MapMeta; width: number; height: number }) => {
        setMapMeta(info.meta);
        setMapHeight(info.height);
    }, []);

    const gridMetadata = useMemo(() => ({
        width: storeMapWidth || MOCK_MAP_SIZE.width,
        height: storeMapHeight || MOCK_MAP_SIZE.height,
        resolution: 0.05
    }), [storeMapWidth, storeMapHeight]);

    // --- 모달 상태 ---
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        action: string;
        onConfirm: () => void;
    }>({ open: false, action: '', onConfirm: () => { } });

    // --- 액션 핸들러 ---
    const addLog = (type: string, message: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [{ id: Date.now(), type, message, timestamp: time }, ...prev]);
    };

    const handleConfirm = () => {
        confirmModal.onConfirm();
        setConfirmModal({ ...confirmModal, open: false });
    };

    // --- 롱프레스 핸들러 (1초 유지 시 동작) ---
    // 이동 제어
    const moveLongPress = useLongPress(() => {
        setConfirmModal({
            open: true,
            action: moveState === 'stopped' ? 'REQUEST PUSHBACK' : 'STOP VEHICLE',
            onConfirm: () => {
                if (moveState === 'stopped') {
                    setMoveState('pushback');
                    addLog('info', 'REQ: Pushback Requested');
                } else {
                    setMoveState('stopped');
                    addLog('info', 'CMD: Vehicle Stopped');
                }
            }
        });
    }, () => { });

    // 연결 제어
    const connLongPress = useLongPress(() => {
        // 이미 진행 중인 상태면 무시
        if (connState === 'waiting' || connState === 'connecting' || connState === 'disconnecting') return;

        setConfirmModal({
            open: true,
            action: connState === 'disconnected' ? 'CONNECT TUG' : 'DISCONNECT TUG',
            onConfirm: async () => {
                if (connState === 'disconnected') {
                    // --- CONNECT FLOW ---
                    setConnState('waiting');
                    addLog('info', 'REQ: Requesting Tug Connection...');
                    try {
                        await request('/app/car/connect', {
                            type: 'CONNECT_REQUEST',
                            pilotId: 'PILOT_001',
                            timestamp: Date.now()
                        }, 5000);
                        // 응답은 성공했지만, 상태 변경은 나중에 이벤트(APPROVED)로 처리됨
                    } catch (e) {
                        setConnState('disconnected');
                        addLog('error', 'SYS: Connection Request Timeout');
                    }
                } else {
                    // --- DISCONNECT FLOW ---
                    setConnState('waiting'); // Disconnect도 요청 후 대기
                    addLog('info', 'REQ: Requesting Disconnection...');
                    try {
                        await request('/app/car/disconnect', {
                            type: 'DISCONNECT_REQUEST',
                            pilotId: 'PILOT_001',
                            timestamp: Date.now()
                        }, 5000);
                    } catch (e) {
                        setConnState('connected'); // 실패 시 다시 연결 상태로 유지
                        addLog('error', 'SYS: Disconnect Request Timeout');
                    }
                }
            }
        });
    }, () => { });

    // 모드 전환
    const modeLongPress = useLongPress(() => {
        setConfirmModal({
            open: true,
            action: !isAutoMode ? 'SWITCH TO AUTO' : 'SWITCH TO MANUAL',
            onConfirm: () => {
                setIsAutoMode(!isAutoMode);
                addLog('info', !isAutoMode ? 'SYS: Auto Pilot Engaged' : 'SYS: Manual Control Engaged');
            }
        });
    }, () => { });

    // --- 비상 정지 (즉시 실행) ---
    const handleEmergencyStop = () => {
        setMoveState('stopped');
        setIsAutoMode(false);
        addLog('error', '!!! EMERGENCY STOP TRIGGERED !!!');
        alert('EMERGENCY STOP! All Systems Halted.');
    };

    return (
        <div className="h-full w-full bg-black px-4 pb-4 text-slate-200 font-mono overflow-hidden flex flex-col gap-4">

            {/* 
                --- 레이아웃 구조 (Grid System) ---
                총 12 컬럼 그리드 사용.
                
                Top Row (높이 60%): 3개 컬럼
                - T1 (Camera): span 5 (Bottom 1+2 커버)
                - T2 (Map): span 5 (Bottom 3 커버)
                - T3 (Log): span 2 (Bottom 4 커버)
                
                Bottom Row (높이 40%): 4개 컬럼
                - B1 (Buttons): span 2
                - B2 (Status): span 3
                - B3 (Nav): span 5
                - B4 (Safety): span 2
            */}

            {/* --- TOP ROW --- */}
            <div className="grid grid-cols-12 gap-4 h-[60%]">


            {/* T1: Camera View (Covers Buttons + Status) */}
            <Card className="col-span-5 glass-panel flex flex-col">
                <CardHeader className="py-3 border-b border-white/10 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                        <Radio className={cn("w-4 h-4 transition-colors", isCamEnabled ? "text-green-500 animate-pulse" : "text-slate-600")} />
                        POV CAMERA FEED
                    </CardTitle>
                    {/* Camera Toggle Switch */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-500">{isCamEnabled ? 'ON' : 'OFF'}</span>
                        <button 
                            onClick={() => setIsCamEnabled(!isCamEnabled)}
                            className={cn(
                                "w-8 h-4 rounded-full relative transition-colors duration-300 focus:outline-none focus:ring-1 focus:ring-cyan-500",
                                isCamEnabled ? "bg-green-500/20 border border-green-500/50" : "bg-slate-700 border border-slate-600"
                            )}
                        >
                            <div className={cn(
                                "absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all duration-300 shadow-sm",
                                isCamEnabled ? "left-[18px] bg-green-400 shadow-[0_0_5px_#4ade80]" : "left-0.5 bg-slate-400"
                            )} />
                        </button>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 relative bg-black/60 overflow-hidden group">
                    <CameraFeed 
                        enabled={isCamEnabled} 
                        carId="CAR_102" // Hardcoded for demo, or derive from selected/assigned Tug
                        className="w-full h-full"
                    />
                </CardContent>
            </Card>

                {/* T2: Digital Twin Map (Covers Navigation Data) */}
                <Card className="col-span-5 glass-panel relative overflow-hidden flex flex-col">
                    <CardHeader className="py-3 border-b border-white/10 z-10 bg-black/20 backdrop-blur">
                        <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-cyan-500" />
                            DIGITAL TWIN NAVIGATION
                        </CardTitle>
                    </CardHeader>
                    {/* Map Canvas Integration */}
                    <div className="flex-1 relative bg-black/40 overflow-hidden">
                        <MapCanvas
                            mapName="pilot_grid"
                            visualStyle="abstract"
                            gridMetadata={gridMetadata}
                            className="w-full h-full"
                            onMapLoad={handleMapLoad}
                            onMapClick={(pos) => console.log("Pilot Map Click:", pos)}
                        >
                            <GraphInteractionLayer meta={mapMeta} mapHeight={mapHeight} />
                            <AircraftLayer
                                meta={mapMeta}
                                mapWidth={storeMapWidth || MOCK_MAP_SIZE.width}
                                mapHeight={storeMapHeight || MOCK_MAP_SIZE.height}
                                onAircraftClick={(ac) => setSelectedAircraft(ac)}
                            />
                        </MapCanvas>
                    </div>
                </Card>

            {/* T3: Activity Timeline */}
                <PilotTimeline logs={logs} />
            </div>

            {/* --- BOTTOM ROW --- */}
            <div className="grid grid-cols-12 gap-4 h-[40%]">

                {/* B1: Control Buttons (span 2) */}
                <PilotCommandButtons 
                    moveState={moveState} 
                    connState={connState} 
                    moveLongPress={moveLongPress} 
                    connLongPress={connLongPress} 
                />

                {/* B2: Status Panel (span 3) */}
                <PilotTugStatus />

                {/* B3: Navigation Data (span 5) */}
                <PilotFlightInfo moveState={moveState} />

                {/* B4: Critical Alerts (span 2) */}
                <PilotSafetyControls 
                    isAutoMode={isAutoMode} 
                    modeLongPress={modeLongPress} 
                    handleEmergencyStop={handleEmergencyStop} 
                />
            </div>
            {/* --- Confirmation Modal (Action Check) --- */}
            {confirmModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <Card className="w-[400px] bg-slate-900 border-slate-700 text-slate-200 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <CheckCircle className="text-accent-cyan" />
                                CONFIRM ACTION
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="py-6 text-center">
                            <p className="text-lg mb-2">Are you sure?</p>
                            <p className="text-slate-400 text-sm">Action: <span className="text-accent-cyan font-bold">{confirmModal.action}</span></p>
                        </CardContent>
                        <div className="flex p-4 gap-4 border-t border-slate-800 bg-slate-950/50">
                            <Button
                                variant="ghost"
                                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                                className="flex-1"
                            >
                                CANCEL
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                className="flex-1 bg-accent-cyan text-black hover:bg-cyan-400"
                            >
                                CONFIRM
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
