import { AlertCircle, XOctagon } from "lucide-react";

export function ApprovalQueue() {
  return (
    <div className="flex flex-col h-[40%] glass-panel rounded-xl p-0 relative overflow-hidden shrink-0 border-accent-red/50 shadow-[0_0_15px_rgba(255,0,0,0.15)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 border-b border-accent-red/30 bg-accent-red/5">
        <h2 className="text-sm font-bold tracking-wider text-accent-red uppercase flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Critical Alerts
        </h2>
        <div className="h-2 w-2 rounded-full bg-accent-red animate-ping" />
      </div>
      
      {/* Alert List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
         {/* Alert Item 1 */}
         <div className="p-3 rounded border border-accent-red/40 bg-accent-red/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1">
                <span className="text-[10px] text-accent-red/70 font-mono">Just now</span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <XOctagon className="w-3 h-3 text-accent-red" />
                MANUAL MODE
            </h3>
            <p className="text-[11px] text-gray-400 leading-tight mb-2">
                Manual control request from pilot - obstacle detected on route
            </p>
            <div className="flex gap-2">
                <button className="flex-1 py-1 bg-accent-red text-white text-[10px] font-bold rounded hover:bg-red-600 transition-colors uppercase">
                    Approve
                </button>
                <button className="flex-1 py-1 bg-transparent border border-accent-red/30 text-accent-red text-[10px] font-bold rounded hover:bg-accent-red/10 transition-colors uppercase">
                    Reject
                </button>
            </div>
         </div>

         {/* Alert Item 2 */}
         <div className="p-3 rounded border border-accent-red/20 bg-accent-red/5 opacity-70">
            <h3 className="text-sm font-bold text-gray-300 mb-0.5">EMERGENCY STOP</h3>
            <p className="text-[10px] text-gray-500 font-mono">AC-N8247E • MSN-2026-001</p>
         </div>
      </div>
    </div>
  );
}
