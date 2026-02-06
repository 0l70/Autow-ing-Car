import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'PILOT' | 'ATC'; // Backend Enum Value

interface User {
    email: string;
    role: UserRole;
    carId?: string; // PILOT 전용
}

interface AuthState {
    accessToken: string | null;
    socketToken: string | null;
    refreshToken: string | null; // NEW: Refresh Token 추가
    user: User | null;
    isAuthenticated: boolean;
    login: (accessToken: string, refreshToken: string, socketToken: string, role: UserRole, email: string, carId?: string) => void;
    setTokens: (accessToken: string, refreshToken: string, socketToken: string) => void; // NEW: Token Refresh용
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            socketToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
            login: (accessToken, refreshToken, socketToken, role, email) => {
                const newUser: User = { 
                    email, 
                    role
                };
                set({ 
                    accessToken,
                    refreshToken,
                    socketToken,
                    user: newUser, 
                    isAuthenticated: true 
                });
            },
            setTokens: (accessToken, refreshToken, socketToken) => {
                set({ accessToken, refreshToken, socketToken });
            },
            logout: () => {
                sessionStorage.clear();
                localStorage.clear();
                set({ 
                    accessToken: null, 
                    socketToken: null,
                    refreshToken: null,
                    user: null, 
                    isAuthenticated: false 
                });
            },
        }),
        {
            name: 'auth-storage', // localStorage key
            // [IMPORTANT] Only persist refreshToken and user info. 
            // accessToken and socketToken stay in memory only.
            partialize: (state) => ({ 
                refreshToken: state.refreshToken, 
                user: state.user,
                isAuthenticated: state.isAuthenticated 
            }),
        }
    )
);
