import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'PILOT' | 'ATC'; // ADMIN 제외

interface User {
    email: string;
    role: UserRole;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    login: (token: string, role: UserRole, email: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            isAuthenticated: false,
            login: (token, role, email) => set({ 
                token, 
                user: { email, role }, 
                isAuthenticated: true 
            }),
            logout: () => set({ 
                token: null, 
                user: null, 
                isAuthenticated: false 
            }),
        }),
        {
            name: 'auth-storage', // localStorage key
        }
    )
);
