import { LayoutDashboard, Map as MapIcon } from "lucide-react";

interface NavbarProps {
    // Props removed as navigation is flat now
}

export function Navbar({}: NavbarProps) {
    return (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                
                <div className="flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 shadow-[0_0_10px_rgba(0,255,255,0.2)]">
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="font-mono uppercase">Control Center</span>
                </div>

            </div>
        </div>
    );
}
