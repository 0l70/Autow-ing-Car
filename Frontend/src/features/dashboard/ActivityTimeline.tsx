import { Activity } from "lucide-react";
import { useTimelineStore } from "./model/useTimelineStore";
import { cn } from "@/shared/lib/utils";

export function ActivityTimeline() {
  const logs = useTimelineStore(state => state.logs);

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full glass-panel rounded-xl overflow-hidden relative border-accent-cyan/30 shadow-[0_0_10px_rgba(0,255,255,0.1)]">
        {/* Header */}
        <div className="p-4 pb-3 border-b border-accent-cyan/20 bg-accent-cyan/5">
            <h2 className="text-lg font-bold tracking-normal text-white uppercase flex items-center gap-3">
                <Activity className="w-5 h-5 text-accent-cyan" strokeWidth={3} />
                ACTIVITY TIMELINE
            </h2>

        </div>
        
        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            {logs.length === 0 && (
                <div className="text-center text-xs text-gray-500 mt-10 opacity-50">
                    No activity recorded yet.
                </div>
            )}
            {logs.map((log) => (
                <div key={log.id} className="relative pl-4 border-l-2 border-[hsl(var(--gray-600)_/_0.5)] hover:border-accent-cyan/50 transition-colors group">
                    {/* Timeline Dot */}
                    <div className={cn(
                        "absolute -left-[5px] top-0 h-2 w-2 rounded-full transition-colors",
                        log.type === 'APPROVE' ? "bg-accent-cyan" : 
                        log.type === 'REJECT' ? "bg-accent-red" : "bg-accent-orange"
                    )} />
                    
                    {/* Time */}
                    <div className="text-[11px] font-mono text-[hsl(var(--gray-600))] mb-0.5 leading-none">
                        {new Date(log.timestamp).toLocaleTimeString([], {hour12: true})}
                    </div>
                    
                    {/* Content */}
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-white leading-tight">{log.message}</span>
                        <span className="text-xs text-[hsl(var(--gray-400))] leading-tight">{log.subMessage}</span>
                        <span className={cn(
                            "text-xs font-bold mt-1",
                            log.type === 'APPROVE' ? "text-accent-cyan" : 
                            log.type === 'REJECT' ? "text-accent-red" : "text-accent-orange"
                        )}>{log.actor}</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
