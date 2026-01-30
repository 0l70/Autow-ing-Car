import { useState } from 'react';
import { Radio } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/Card";
import { cn } from "@/shared/lib/utils";
import { CameraFeed } from "@/features/dashboard/ui/CameraFeed";

interface CameraWidgetProps {
    className?: string;
    carId?: string; // Default to CAR_102 if not provided
}

export function CameraWidget({ className, carId = "CAR_102" }: CameraWidgetProps) {
    const [isEnabled, setIsEnabled] = useState(false);

    return (
        <Card className={cn("glass-panel flex flex-col", className)}>
            <CardHeader className="py-3 border-b border-white/10 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold tracking-wide text-slate-400 flex items-center gap-2">
                    <Radio className={cn("w-4 h-4 transition-colors", isEnabled ? "text-green-500 animate-pulse" : "text-slate-600")} />
                    POV CAMERA FEED
                </CardTitle>
                {/* Camera Toggle Switch */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500">{isEnabled ? 'ON' : 'OFF'}</span>
                    <button 
                        onClick={() => setIsEnabled(!isEnabled)}
                        className={cn(
                            "w-8 h-4 rounded-full relative transition-colors duration-300 focus:outline-none focus:ring-1 focus:ring-cyan-500",
                            isEnabled ? "bg-green-500/20 border border-green-500/50" : "bg-slate-700 border border-slate-600"
                        )}
                    >
                        <div className={cn(
                            "absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all duration-300 shadow-sm",
                            isEnabled ? "left-[18px] bg-green-400 shadow-[0_0_5px_#4ade80]" : "left-0.5 bg-slate-400"
                        )} />
                    </button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative bg-black/60 overflow-hidden group min-h-[200px]">
                <CameraFeed 
                    enabled={isEnabled} 
                    carId={carId} 
                    className="w-full h-full"
                />
            </CardContent>
        </Card>
    );
}
