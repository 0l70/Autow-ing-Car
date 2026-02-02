import { useState, useCallback } from 'react';

export function useFlightWelcome() {
    const [isOpen, setIsOpen] = useState(false);

    const checkAndShow = useCallback((flightId: number) => {
        const storageKey = `pilot_welcome_${flightId}`;
        const hasSeen = sessionStorage.getItem(storageKey);

        if (!hasSeen) {
            setIsOpen(true);
            sessionStorage.setItem(storageKey, 'true');
        }
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    return {
        isOpen,
        checkAndShow,
        close
    };
}
