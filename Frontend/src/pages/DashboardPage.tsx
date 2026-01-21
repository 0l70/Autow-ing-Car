import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { ApprovalQueue } from "@/features/dashboard/ApprovalQueue";
import { ActivityTimeline } from "@/features/dashboard/ActivityTimeline";
import { MissionInspector } from "@/features/dashboard/MissionInspector";
import { Navigation } from "lucide-react";

export function DashboardPage() {
  return (
    <MainLayout
        leftPanel={
            <>
                <ApprovalQueue />
                <ActivityTimeline />
            </>
        }
        rightPanel={<MissionInspector />}
    >
      <div className="absolute inset-0 flex items-center justify-center p-8">
         {/* Map Placeholder Content */}
         <div className="relative w-full h-full border border-white/5 rounded-lg flex items-center justify-center bg-black/20">
            {/* Map Labels */}
            <div className="absolute top-4 left-4 p-3 bg-black/80 rounded-lg border border-white/10 text-xs shadow-lg backdrop-blur z-20">
                <div className="text-gray-400 font-bold mb-2 uppercase tracking-wider text-[10px]">Map Legend</div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-0.5 bg-accent-orange shadow-[0_0_5px_rgba(255,120,0,1)]"></span> 
                    <span className="text-white font-mono">Confirmed Route</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-0.5 bg-accent-cyan/50 dashed border-b border-dashed border-accent-cyan"></span> 
                    <span className="text-gray-400 font-mono">Candidate Route</span>
                </div>
                <div className="flex items-center gap-2 mb-1 mt-2">
                    <Navigation className="w-3 h-3 text-accent-cyan" strokeWidth={3} />
                    <span className="text-gray-400 font-mono">Aircraft</span>
                </div>
            </div>

            {/* SVG MAP */}
            <div className="absolute inset-0 w-full h-full opacity-90 overflow-hidden">
                <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--accent-orange))" />
                        </marker>
                    </defs>
                    
                    {/* Grid Lines (Subtle) */}
                    <path d="M100 0 V600 M200 0 V600 M300 0 V600 M400 0 V600 M500 0 V600 M600 0 V600 M700 0 V600" stroke="white" strokeOpacity="0.03" />
                    <path d="M0 100 H800 M0 200 H800 M0 300 H800 M0 400 H800 M0 500 H800" stroke="white" strokeOpacity="0.03" />

                    {/* Route Path */}
                    <path d="M150 150 L250 200 L350 250 L450 300 L550 320 L750 380" 
                          stroke="hsl(var(--accent-orange))" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" 
                          className="drop-shadow-[0_0_8px_rgba(255,120,0,0.6)]" />

                    {/* Waypoints */}
                    <g className="font-mono text-[10px] fill-white/80">
                        <circle cx="150" cy="150" r="4" fill="hsl(var(--accent-orange))" /><text x="140" y="140">Gate 12</text>
                        <circle cx="250" cy="200" r="3" fill="hsl(var(--accent-orange))" /><text x="250" y="190">Taxi A-1</text>
                        <circle cx="350" cy="250" r="3" fill="hsl(var(--accent-orange))" /><text x="350" y="240">Taxi A-2</text>
                        <circle cx="550" cy="320" r="3" fill="hsl(var(--accent-orange))" /><text x="560" y="310">Taxi A-3</text>
                        <circle cx="750" cy="380" r="4" fill="hsl(var(--accent-orange))" /><text x="740" y="370">Runway</text>
                    </g>
                    
                    {/* Ghost Path (Future) */}
                    <path d="M350 250 L400 350 L500 450" stroke="hsl(var(--gray-600))" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

                    {/* --- AIRCRAFT ONLY --- */}
                    <g transform="translate(360, 255)">
                        {/* Radar Ripple Effect */}
                        <circle cx="0" cy="0" r="30" stroke="hsl(var(--accent-red))" strokeWidth="1" opacity="0.5" className="animate-ping" />
                        <circle cx="0" cy="0" r="50" stroke="hsl(var(--accent-red))" strokeWidth="0.5" opacity="0.3" className="animate-pulse" />
                        
                        {/* Icon */}
                        <path d="M-8 -8 L0 12 L8 -8 L0 -4 Z" fill="black" stroke="hsl(var(--accent-cyan))" strokeWidth="2" transform="rotate(135)" />
                        
                        {/* Label Badge */}
                        <g transform="translate(15, -20)">
                            <rect x="0" y="0" width="70" height="18" rx="2" fill="black" strokeOpacity="0.5" stroke="hsl(var(--gray-600))" fillOpacity="0.8" />
                            <text x="5" y="12" fill="white" fontSize="10" fontWeight="bold">AC-N7742J</text>
                        </g>

                        {/* Connection Line to Tow (Implicit/Hidden) or Status */}
                    </g>
                </svg>
            </div>
         </div>
      </div>
    </MainLayout>
  );
}
