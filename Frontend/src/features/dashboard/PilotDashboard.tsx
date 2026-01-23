import { MainLayout } from "@/shared/ui/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";

export function PilotDashboard() {
    return (
        <MainLayout
            leftPanel={
                <Card className="bg-slate-900 border-slate-800 text-white h-full">
                    <CardHeader>
                        <CardTitle>Pilot Control</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button className="w-full bg-cyan-600 hover:bg-cyan-700">
                            Request Takeoff
                        </Button>
                        <Button className="w-full bg-slate-700 hover:bg-slate-800">
                            Report Status
                        </Button>
                    </CardContent>
                </Card>
            }
            rightPanel={
                <Card className="bg-slate-900 border-slate-800 text-white h-full">
                     <CardHeader>
                        <CardTitle>Mission Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-400">No active mission</p>
                    </CardContent>
                </Card>
            }
        >
             <div className="flex items-center justify-center p-8 h-full text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Cockpit View</h2>
                    <p className="text-slate-400">Map visualization tailored for Pilot will be here.</p>
                </div>
            </div>
        </MainLayout>
    );
}
