import React from 'react';

export function MainLayout({ 
    leftPanel, 
    rightPanel, 
    children 
}: { 
    leftPanel?: React.ReactNode; 
    rightPanel?: React.ReactNode; 
    children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-bg-primary text-foreground">
      {/* GLOBAL BACKGROUND LAYERS */}
      {/* 1. Base Grid Pattern (Covers entire screen) */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none z-0" />
      
      {/* 2. Global Vignette (Darkens edges) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(6,10,20,0.8)_100%)] pointer-events-none z-0" />

      {/* Zone A: Left Sidebar (Floating Widgets) */}
      <aside className="w-[360px] flex flex-col z-10 p-4 gap-4 pointer-events-none relative">
        {/* Logo Area */}
        <div className="p-4 rounded-xl glass-panel pointer-events-auto shrink-0 mb-2">
            <h1 className="text-2xl font-black text-white leading-none tracking-tight">
                ATC<br />
                CONTROL<br />
                CENTER
            </h1>
        </div>
        
        {/* Widgets Area */}
        <div className="flex-1 flex flex-col gap-4 min-h-0 pointer-events-auto">
            {leftPanel}
        </div>
      </aside>

      {/* Zone B: Center Map (Content Only) */}
      <main className="flex-1 relative overflow-hidden z-10 border-x border-[var(--widget-border)]">
        {/* Route/Map Content Layer */}
        <div className="relative w-full h-full">
            {children}
        </div>
      </main>

      {/* Zone C: Right Inspector (Floating Widgets) */}
      <aside className="w-[400px] z-10 flex flex-col p-4 gap-4 pointer-events-none relative">
        <div className="flex-1 flex flex-col gap-4 min-h-0 pointer-events-auto">
            {rightPanel}
        </div>
      </aside>
    </div>
  );
}
