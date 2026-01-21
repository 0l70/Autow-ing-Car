import { LayoutDashboard, Map as MapIcon } from "lucide-react";

interface NavbarProps {
    currentTab: 'dashboard' | 'editor';
    onTabChange: (tab: 'dashboard' | 'editor') => void;
}

export function Navbar({ currentTab, onTabChange }: NavbarProps) {
    return (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                
                <button
                    onClick={() => onTabChange('dashboard')}
                    className={`
                        flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-300
                        ${currentTab === 'dashboard' 
                            ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 shadow-[0_0_10px_rgba(0,255,255,0.2)]' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'}
                    `}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="font-mono uppercase">Dashboard</span>
                </button>

                <div className="w-[1px] h-4 bg-white/10 mx-1" />

                <button
                    onClick={() => onTabChange('editor')}
                    className={`
                        flex items-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all duration-300
                        ${currentTab === 'editor' 
                            ? 'bg-accent-orange/10 text-accent-orange border border-accent-orange/30 shadow-[0_0_10px_rgba(255,165,0,0.2)]' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'}
                    `}
                >
                    <MapIcon className="w-4 h-4" />
                    <span className="font-mono uppercase">Map Editor</span>
                </button>

            </div>
        </div>
    );
}
