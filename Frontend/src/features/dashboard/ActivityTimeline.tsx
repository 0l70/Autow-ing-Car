import { Activity } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function ActivityTimeline() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full glass-panel rounded-xl overflow-hidden relative border-accent-cyan/30 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
        {/* Header */}
        <div className="p-4 pb-3 border-b border-accent-cyan/20 bg-accent-cyan/5">
            <h2 className="text-lg font-bold tracking-normal text-white uppercase flex items-center gap-3">
                <Activity className="w-5 h-5 text-accent-cyan" strokeWidth={3} />
                ACTIVITY TIMELINE
            </h2>
            <div className="text-[10px] text-[hsl(var(--gray-600))] mt-1 font-mono overflow-hidden whitespace-nowrap text-ellipsis opacity-50">
                [Source: GET /api/v1/vehicles/&#123;vehicleId&#125;/timeline]
            </div>
        </div>
        
        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {[1, 2, 3].map((_, i) => (
                <div key={i} className="relative pl-4 border-l-2 border-[hsl(var(--gray-600)_/_0.5)] hover:border-accent-cyan/50 transition-colors group">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-[hsl(var(--gray-600))] group-hover:bg-accent-cyan transition-colors" />
                    
                    {/* Time */}
                    <div className="text-[11px] font-mono text-[hsl(var(--gray-600))] mb-0.5 leading-none">
                        10:16:3{i} AM
                    </div>
                    
                    {/* Content */}
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-white leading-tight">ALERT APPROVED</span>
                        <span className="text-xs text-[hsl(var(--gray-400))] leading-tight">MOVEMENT_CLEARANCE approved</span>
                        <span className="text-xs font-bold text-accent-cyan mt-1">ATC-Williams</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
