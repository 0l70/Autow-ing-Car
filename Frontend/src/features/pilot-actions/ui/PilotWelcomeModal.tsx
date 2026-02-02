
import { Plane } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { FlightInfo } from "@/features/dashboard/model/dashboardTypes";

interface PilotWelcomeModalProps {
    isOpen: boolean;
    data: FlightInfo | null;
    onClose: () => void;
}

export function PilotWelcomeModal({ isOpen, data, onClose }: PilotWelcomeModalProps) {
    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-[500px] bg-slate-900 border-slate-700 text-slate-200 shadow-2xl">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <Plane className="text-accent-cyan w-5 h-5" />
                        FLIGHT ASSIGNMENT
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-8 text-center px-8">
                    <p className="text-xl leading-relaxed text-slate-300">
                        Hello, Captain <span className="text-accent-cyan font-bold">{data.pilotName}</span>.
                        <br />
                        Your aircraft (<span className="text-accent-cyan font-mono font-bold">{data.aircraftTypeCode}</span>) for Flight <span className="text-accent-cyan font-mono font-bold">{data.flightNumber}</span> to <span className="text-accent-cyan font-bold">{data.destination}</span> is prepared.
                    </p>
                </CardContent>
                <div className="flex p-4 border-t border-slate-800 bg-slate-950/50">
                    <Button
                        onClick={onClose}
                        className="w-full bg-accent-cyan text-black hover:bg-cyan-400 font-bold tracking-wide"
                    >
                        CONFIRM ASSIGNMENT
                    </Button>
                </div>
            </Card>
        </div>
    );
}
