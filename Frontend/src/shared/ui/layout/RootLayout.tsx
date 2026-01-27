import React from 'react';
import { Header } from "@/widgets/header";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-primary text-foreground">
      {/* GLOBAL BACKGROUND LAYERS (Moved here from MainLayout) */}
      {/* 1. Base Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none z-0" />
      
      {/* 2. Global Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(6,10,20,0.8)_100%)] pointer-events-none z-0" />

      {/* TOP HEADER (Fixed) */}
      <Header />

      {/* DYNAMIC CONTENT AREA */}
      <main className="flex-1 relative overflow-hidden z-10">
        {children}
      </main>
    </div>
  );
}
