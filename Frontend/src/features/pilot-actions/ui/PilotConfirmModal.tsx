
import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";

interface PilotConfirmModalProps {
    isOpen: boolean;
    action: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function PilotConfirmModal({ isOpen, action, onConfirm, onCancel }: PilotConfirmModalProps) {
    if (!isOpen) return null;

    return (
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
                    <p className="text-slate-400 text-sm">Action: <span className="text-accent-cyan font-bold">{action}</span></p>
                </CardContent>
                <div className="flex p-4 gap-4 border-t border-slate-800 bg-slate-950/50">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        className="flex-1"
                    >
                        CANCEL
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="flex-1 bg-accent-cyan text-black hover:bg-cyan-400"
                    >
                        CONFIRM
                    </Button>
                </div>
            </Card>
        </div>
    );
}
