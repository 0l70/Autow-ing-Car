import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Navigation, Signal, Battery,
    AlertTriangle, CheckCircle,
    Map as MapIcon, ShieldAlert,
    Radio
} from 'lucide-react';
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import useLongPress from "@/shared/lib/useLongPress";
import { INITIAL_LOGS, VEHICLE_STATUS, NAVIGATION_DATA } from './MockData';

// --- Map Integration ---
import { MapCanvas } from "@/widgets/map-panel/MapCanvas";
import { GraphInteractionLayer } from "@/features/map-editor/ui/GraphInteractionLayer";
import { AircraftLayer } from "@/features/map-visualizer/ui/AircraftLayer";
import { useGraphStore } from "@/entities/map/model/store";
import { MapMeta, Aircraft } from "@/entities/map/model/types";
import { MOCK_EDGES, MOCK_NODES, MOCK_MAP_SIZE } from "@/entities/map/lib/mockData";
import { useMockAircraftMqtt } from "@/entities/map/lib/mockAircraft";
import { useTelemetrySocket } from "@/features/map-visualizer/model/useTelemetrySocket";

// --- Types ---
// 이동 상태 타입 정의
type MoveState = 'stopped' | 'moving' | 'pushback';
// 연결 상태 타입 정의
type ConnectionState = 'disconnected' | 'waiting' | 'connecting' | 'connected' | 'disconnecting';

export function PilotDashboard() {
    // --- State 관리 ---
    const [logs, setLogs] = useState(INITIAL_LOGS);
    const [moveState, setMoveState] = useState<MoveState>('stopped');
    const [connState, setConnState] = useState<ConnectionState>('disconnected');
    const [isAutoMode, setIsAutoMode] = useState(false);

    // --- 지도 상태 관리 ---
    const { loadGraph, setAircrafts, mapWidth: storeMapWidth, mapHeight: storeMapHeight } = useGraphStore();
    const [mapMeta, setMapMeta] = useState<MapMeta | null>(null);
    const [mapHeight, setMapHeight] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);

    // --- 데이터 소스 ---
    // 관제사와 동일한 Mock 데이터 소스 사용 (추후 WebSocket으로 대체)
    // 관제사와 동일한 Mock 데이터 소스 사용 (추후 WebSocket으로 대체)
    const mockData = useMockAircraftMqtt();
    // WebSocket Hook
    const { request, onMessage } = useTelemetrySocket();

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

    const getLogColor = (type: string) => {
        switch (type) {
            case 'success': return 'text-accent-lime';
            case 'error': return 'text-accent-red';
            case 'warning': return 'text-accent-amber';
            default: return 'text-primary';
        }
    };

    return (
        <div className="h-screen w-full bg-slate-950 p-4 text-slate-200 font-mono overflow-hidden flex flex-col gap-4">

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
                <Card className="col-span-5 bg-slate-900/50 border-slate-800 backdrop-blur-sm flex flex-col">
                    <CardHeader className="py-3 border-b border-slate-800/50">
                        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Radio className="w-4 h-4 text-accent-cyan" />
                            POV Camera Feed
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative bg-black/40 overflow-hidden group">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-slate-600 text-xs">Signal Lost / Placeholder</span>
                        </div>
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded text-[10px] text-green-500">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            LIVE
                        </div>
                        <div className="absolute inset-0 pointer-events-none opacity-20">
                            {/* Camera Reticle Overlay */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/20"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-3 bg-accent-cyan"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-1 bg-accent-cyan"></div>
                        </div>
                    </CardContent>
                </Card>

                {/* T2: Digital Twin Map (Covers Navigation Data) */}
                <Card className="col-span-5 bg-slate-900 border-slate-800 relative overflow-hidden flex flex-col">
                    <CardHeader className="py-3 border-b border-slate-800 z-10 bg-slate-900/90 backdrop-blur">
                        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-accent-cyan" />
                            Digital Twin Navigation
                        </CardTitle>
                    </CardHeader>
                    {/* Map Canvas Integration */}
                    <div className="flex-1 relative bg-slate-950 overflow-hidden">
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

                {/* T3: System Logs (Covers Safety Controls) */}
                <Card className="col-span-2 bg-slate-900/50 border-slate-800 flex flex-col">
                    <CardHeader className="py-3 border-b border-slate-800/50">
                        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-accent-amber" />
                            Logs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-2 overflow-y-auto space-y-2 scrollbar-hide">
                        {logs.map(log => (
                            <div key={log.id} className="text-xs p-2 rounded bg-slate-950/50 border border-slate-800/50 border-l-2 border-l-slate-700">
                                <div className="flex justify-between text-slate-500 mb-1 font-mono text-[9px]">
                                    <span>{log.type.toUpperCase().slice(0, 3)}</span>
                                    <span>{log.timestamp}</span>
                                </div>
                                <div className={`${getLogColor(log.type)} leading-tight`}>
                                    {log.message}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* --- BOTTOM ROW --- */}
            <div className="grid grid-cols-12 gap-4 h-[40%]">

                {/* B1: Control Buttons (span 2) */}
                <div className="col-span-2 flex flex-col gap-4">
                    {/* Move Button */}
                    <div className="relative group flex-1">
                        <Button
                            {...moveLongPress}
                            disabled={connState !== 'connected'}
                            className={`w-full h-full text-base font-bold tracking-wider transition-all duration-300 border-2 whitespace-normal leading-tight
                                ${moveState === 'moving' || moveState === 'pushback'
                                    ? 'bg-accent-amber/10 border-accent-amber text-accent-amber hover:bg-accent-amber/20'
                                    : 'bg-blue-900/30 border-blue-800 text-blue-100 hover:bg-blue-900/50 hover:border-accent-cyan hover:text-accent-cyan'
                                }
                                disabled:opacity-30 disabled:cursor-not-allowed
                            `}
                        >
                            {moveState === 'stopped' ? 'REQUEST PUSHBACK' : 'STOP'}
                            <div className="text-[9px] font-normal opacity-60 absolute bottom-2 font-mono w-full text-center">
                                (Hold 1s)
                            </div>
                        </Button>
                    </div>

                    {/* Connection Button */}
                    <div className="relative group flex-1">
                        <Button
                            {...connLongPress}
                            className={`w-full h-full text-base font-bold tracking-wider transition-all duration-300 border-2 whitespace-normal leading-tight
                                ${connState === 'connected'
                                    ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan shadow-[0_0_10px_rgba(0,255,255,0.1)]'
                                    : (connState === 'connecting' || connState === 'waiting')
                                        ? 'bg-slate-800 border-slate-600 text-slate-400 cursor-wait'
                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                                }
                            `}
                        >
                            {/* 
                                State Mapping:
                                - disconnected -> CONNECT TUG
                                - waiting -> WAITING...
                                - connecting -> CONNECTING... (Transitional)
                                - connected -> DISCONNECT TUG
                            */}
                            {connState === 'connected' ? 'DISCONNECT TUG'
                                : connState === 'waiting' ? 'WAITING...'
                                    : connState === 'connecting' ? 'CONNECTING...'
                                        : 'CONNECT TUG'}

                            {connState === 'connected' && (
                                <div className="text-[9px] font-normal opacity-60 absolute bottom-2 font-mono w-full text-center">
                                    (Hold 1s)
                                </div>
                            )}

                            {(connState === 'waiting' || connState === 'connecting') && (
                                <div className="absolute top-2 right-2">
                                    <div className="w-2 h-2 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                                </div>
                            )}
                        </Button>
                    </div>
                </div>

                {/* B2: Status Panel (span 3) */}
                <Card className="col-span-3 bg-slate-900 border-slate-800 flex flex-col">
                    <CardHeader className="py-2 border-b border-slate-800/50">
                        <CardTitle className="text-sm text-slate-400">TUG STATUS</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 flex flex-col justify-center gap-4">
                        <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
                            <span className="text-slate-500 text-xs">TUG ID</span>
                            <span className="text-lg font-bold text-white">{VEHICLE_STATUS.id}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
                            <span className="text-slate-500 flex items-center gap-2 text-xs">
                                <Battery className="w-3 h-3" /> BATTERY
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-green-500 font-bold">{VEHICLE_STATUS.battery}%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
                            <span className="text-slate-500 flex items-center gap-2 text-xs">
                                <Signal className="w-3 h-3" /> SIGNAL
                            </span>
                            <span className="text-accent-cyan text-xs">{VEHICLE_STATUS.signal}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* B3: Navigation Data (span 5) */}
                <Card className="col-span-5 bg-slate-900 border-slate-800 flex flex-col">
                    <CardHeader className="py-2 border-b border-slate-800/50">
                        <CardTitle className="text-sm text-slate-400">NAVIGATION DATA</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-4 grid grid-cols-2 gap-4 items-center">
                        <div className="bg-slate-950 p-4 rounded border border-slate-800 h-full flex flex-col justify-center">
                            <span className="text-slate-500 text-xs block mb-1">GROUND SPEED</span>
                            <span className="text-4xl font-bold text-white font-mono">
                                {moveState !== 'stopped' ? '15' : '0'} <span className="text-sm text-slate-500">km/h</span>
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 h-full">
                            <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-center flex-1">
                                <span className="text-slate-500 text-xs">HEADING</span>
                                <span className="text-xl font-bold text-white font-mono">{NAVIGATION_DATA.heading}°</span>
                            </div>
                            <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-center flex-1">
                                <span className="text-slate-500 text-xs">DIST REMAIN</span>
                                <span className="text-xl font-bold text-accent-amber font-mono">120 m</span>
                            </div>
                            <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-center flex-1">
                                <span className="text-slate-500 text-xs">DESTINATION</span>
                                <span className="text-white font-bold text-xs">{NAVIGATION_DATA.destination}</span>
                            </div>
                        </div>
                        {/* Progress Bar (Full Width) */}
                        <div className="col-span-2 relative h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="absolute top-0 left-0 h-full bg-accent-orange w-[75%] shadow-[0_0_10px_rgba(255,165,0,0.5)]"></div>
                        </div>
                    </CardContent>
                </Card>

                {/* B4: Safety Controls (span 2) */}
                <div className="col-span-2 flex flex-col gap-4">
                    {/* Mode Toggle */}
                    <div className="flex-1 relative">
                        <Button
                            {...modeLongPress}
                            className={`w-full h-full flex flex-col items-center justify-center border-2 transition-all
                                ${isAutoMode
                                    ? 'bg-slate-800 border-accent-cyan text-accent-cyan'
                                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                }
                             `}
                        >
                            <span className="text-xs mb-1">MODE</span>
                            <span className="text-lg font-bold">{isAutoMode ? 'AUTO' : 'MANUAL'}</span>
                        </Button>
                    </div>

                    {/* Emergency Stop */}
                    <Button
                        onClick={handleEmergencyStop}
                        className="flex-1 bg-accent-red hover:bg-red-600 text-white border-2 border-red-400 shadow-[0_0_30px_rgba(255,0,0,0.3)] animate-pulse-slow p-2"
                    >
                        <div className="flex flex-col items-center justify-center text-center">
                            <AlertTriangle className="w-6 h-6 stroke-2 mb-1" />
                            <span className="text-xs font-black leading-none">EMERGENCY<br />STOP</span>
                        </div>
                    </Button>
                </div>
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
