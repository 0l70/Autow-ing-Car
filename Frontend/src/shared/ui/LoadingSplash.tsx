import React from 'react';

interface LoadingSplashProps {
  message?: string;
}

export function LoadingSplash({ message = 'Restoring Session...' }: LoadingSplashProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 z-[9999]">
      {/* Background Decorative Glow */}
      <div className="absolute w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" />
      
      {/* Spinner Container */}
      <div className="relative flex flex-col items-center gap-6">
        <div className="relative">
          {/* Outer Ring */}
          <div className="w-16 h-16 rounded-full border-4 border-slate-800" />
          {/* Spinning Segment */}
          <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-cyan-500 border-r-cyan-500/30 border-b-transparent border-l-transparent animate-spin" />
          
          {/* Central Point */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]" />
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-bold tracking-widest text-slate-100 uppercase">
            ATC Center
          </h2>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 bg-cyan-500 rounded-full animate-ping" />
            <p className="text-sm font-medium text-slate-400 font-mono tracking-tight">
              {message}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Status bar like decor */}
      <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center opacity-20">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        <span className="px-4 text-[10px] text-cyan-500 font-mono">SYSTEM_INITIALIZING</span>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      </div>
    </div>
  );
}
