import { useState, useCallback } from 'react';

export interface SystemLog {
    id: number;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp: string;
}

export function useSystemLogs() {
    const [logs, setLogs] = useState<SystemLog[]>([
        { 
            id: Date.now(), 
            type: 'info', 
            message: 'System Ready. Waiting for commands...', 
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) 
        }
    ]);

    const addLog = useCallback((type: 'info' | 'success' | 'warning' | 'error', message: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [{ id: Date.now(), type, message, timestamp: time }, ...prev]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return { logs, addLog, clearLogs };
}
