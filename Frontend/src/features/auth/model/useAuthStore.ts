import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'PILOT' | 'ATC'; // ADMIN 제외

interface User {
    email: string;
    role: UserRole;
    carId?: string; // PILOT 전용
}

interface AuthState {
    accessToken: string | null;
    user: User | null;
    socketToken: string | null;
    isAuthenticated: boolean;
    login: (accessToken: string, socketToken: string, role: UserRole, email: string, carId?: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            socketToken: null,
            user: null,
            isAuthenticated: false,
            login: (accessToken, socketToken, role, email, carId) => set({ 
                accessToken,
                socketToken,
                user: { email, role, ...(carId && { carId }) }, 
                isAuthenticated: true 
            }),
            logout: () => set({ 
                accessToken: null, 
                socketToken: null,
                user: null, 
                isAuthenticated: false 
            }),
        }),
        {
            name: 'auth-storage', // localStorage key
        }
    )
);
