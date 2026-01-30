import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { Terminal } from "lucide-react";

export interface TimelineLog {
    id: number;
    type: string;
    message: string;
    timestamp: string;
}

interface PilotTimelineProps {
    logs: TimelineLog[];
}

export function PilotTimeline({ logs }: PilotTimelineProps) {
    return (
        <Card className="col-span-2 glass-panel flex flex-col">
            <CardHeader className="py-3 border-b border-white/10">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-200 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    ACTIVITY TIMELINE
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-3 overflow-y-auto space-y-4 scrollbar-hide">
                {logs.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="relative pl-4 border-l border-slate-700">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-slate-800 
                            ${log.type === 'error' ? 'bg-red-500' : 'bg-cyan-500'}`} 
                        />
                        <div className="text-[10px] text-slate-500 font-mono mb-0.5">
                            {log.timestamp}
                        </div>
                        <div className={`text-xs font-medium leading-tight
                            ${log.type === 'error' ? 'text-red-400' : 
                              log.type === 'success' ? 'text-green-400' : 'text-slate-300'}`}>
                            {log.type === 'info' && <span className="text-cyan-400 font-bold mr-1">INFO</span>}
                            {log.message}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
