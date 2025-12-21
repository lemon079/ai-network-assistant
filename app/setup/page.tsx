'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Router, ShieldCheck, AlertCircle, Info } from "lucide-react";
import { useDetectRouter } from "@/hooks/use-detect-router";
import { useLoginRouter } from "@/hooks/use-login-router";

export default function SetupPage() {
    const router = useRouter();
    const [step, setStep] = useState<'detect' | 'login'>('detect');
    const [routerInfo, setRouterInfo] = useState<{ name: string; ip: string } | null>(null);
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('396E9');

    // useQuery for router detection
    const {
        data: detectionData,
        isLoading: isDetecting,
        error: detectError,
        refetch: retryDetection
    } = useDetectRouter();

    // useMutation for router login
    const {
        mutate: loginRouter,
        isPending: isLoggingIn,
        error: loginError
    } = useLoginRouter();

    // Handle successful detection
    useEffect(() => {
        if (detectionData?.found && detectionData.router) {
            setRouterInfo(detectionData.router);
            setStep('login');
        }
    }, [detectionData]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        if (!routerInfo) return;

        loginRouter(
            {
                ip: routerInfo.ip,
                username,
                password
            },
            {
                onSuccess: () => {
                    setTimeout(() => {
                        router.push('/chat');
                    }, 1000);
                }
            }
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="relative">
                    <div className="absolute top-4 right-4 group">
                        <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                        <div className="absolute right-0 top-6 w-64 p-3 rounded-lg bg-zinc-800 border border-zinc-700 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                            <p className="text-xs text-zinc-300">
                                <span className="font-medium text-blue-400">Note:</span> Currently supports older routers only. Support for newer routers coming soon!
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <Router className="w-6 h-6 text-primary" />
                        <CardTitle>Router Setup</CardTitle>
                    </div>
                    <CardDescription>
                        {step === 'detect' ? 'Detecting your router...' : `Connect to ${routerInfo?.name}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {(detectError || loginError) && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-400">
                                {detectError?.message || loginError?.message || 'An error occurred'}
                            </p>
                        </div>
                    )}

                    {step === 'detect' && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            {isDetecting && <Loader2 className="w-8 h-8 animate-spin text-primary" />}
                            <p className="text-sm text-muted-foreground">
                                {isDetecting ? 'Searching for router...' : 'Click retry to detect your router'}
                            </p>
                        </div>
                    )}

                    {step === 'login' && routerInfo && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                                <ShieldCheck className="w-5 h-5 text-green-500" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Router Detected</p>
                                    <p className="text-xs text-muted-foreground">{routerInfo.name} ({routerInfo.ip})</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="Admin username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={isLoggingIn}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Router password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoggingIn}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoggingIn}>
                                {isLoggingIn ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    'Connect to Router'
                                )}
                            </Button>
                        </form>
                    )}
                </CardContent>
                {step === 'detect' && (
                    <CardFooter>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => retryDetection()}
                            disabled={isDetecting}
                        >
                            {isDetecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Detecting...
                                </>
                            ) : (
                                'Retry Detection'
                            )}
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
