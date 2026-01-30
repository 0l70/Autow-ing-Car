import { useState } from 'react';
import { useAuthStore } from '../model/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const { login } = useAuthStore();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
            const response = await fetch(`${VITE_API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                throw new Error('로그인 실패. 이메일과 비밀번호를 확인하세요.');
            }

            const data = await response.json();
            // AuthDtos.TokenResponse: { accessToken, role, grantType }
            login(data.accessToken, data.socketToken, data.role, email);
            
            // App will re-render and route to Dashboard
        } catch (err: any) {
            setError(err.message || '로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
            <Card className="w-full max-w-sm border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader>
                    <CardTitle className="text-2xl text-center text-cyan-400">ATC Control Center</CardTitle>
                    <CardDescription className="text-center text-slate-400">
                        시스템에 접근하려면 로그인이 필요합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Input 
                                type="email" 
                                placeholder="Email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <Input 
                                type="password" 
                                placeholder="Password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                                required
                            />
                        </div>
                        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                        <Button 
                            type="submit" 
                            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
                            disabled={loading}
                        >
                            {loading ? 'Logging in...' : 'Sign/Tune In'}
                        </Button>
                    </form>
                    
                    {/* Mock Login for Testing */}
                    <div className="mt-4 pt-4 border-t border-slate-800 text-center space-y-2">
                         <div className="text-xs text-slate-500 mb-2">Dev Options</div>
                         <Button 
                            type="button"
                            variant="outline"
                            className="w-full border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={() => {
                                login('mock-access-token', 'mock-socket-token', 'ATC', 'admin@test.com');
                            }}
                        >
                            Mock Login (ATC)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
