import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'PILOT' | 'ATC'; // ADMIN 제외

interface User {
    email: string;
    role: UserRole;
}

interface AuthState {
    accessToken: string | null;
    user: User | null;
    socketToken: string | null;
    isAuthenticated: boolean;
    login: (accessToken: string, socketToken: string, role: UserRole, email: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            socketToken: null,
            user: null,
            isAuthenticated: false,
            login: (accessToken, socketToken, role, email) => set({ 
                accessToken,
                socketToken,
                user: { email, role }, 
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
