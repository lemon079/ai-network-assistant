'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, RotateCcw } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

import { EmptyState } from "@/components/chat/empty-state";
import { ChatMessage, Message } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { ReasoningTrace } from "@/components/chat/reasoning-trace";

export default function Chat() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // State for reasoning trace - just the current step
    const [currentStep, setCurrentStep] = useState<string>('');

    // State for streaming content
    const [streamingContent, setStreamingContent] = useState<string>('');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Try to get session from API
                const response = await fetch('/api/auth/check', { method: 'GET' });
                if (!response.ok) {
                    // Not authenticated, redirect to setup
                    router.replace('/setup');
                    return;
                }
                setIsCheckingAuth(false);
            } catch (error) {
                console.error('Auth check failed:', error);
                router.replace('/setup');
            }
        };
        checkAuth();
    }, [router]);

    // Scroll to bottom when messages or streaming content changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentStep, streamingContent]);

    const handleNewChat = () => {
        setMessages([]);
        setCurrentStep('');
        setStreamingContent('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: input,
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setCurrentStep('');
        setStreamingContent('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Session expired, redirect to setup
                    router.replace('/setup');
                    return;
                }
                throw new Error('Failed to get response');
            }

            // Handle SSE stream
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE messages (data: {...}\n\n)
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // Keep incomplete message in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6));

                            if (event.type === 'step') {
                                // Update current step
                                setCurrentStep(event.step);
                            } else if (event.type === 'tool') {
                                // Update current step with tool info
                                setCurrentStep(event.tool);
                            } else if (event.type === 'content') {
                                // Append streaming content
                                setStreamingContent(prev => prev + event.content);
                            } else if (event.type === 'done') {
                                // Clear the step and add assistant message
                                setCurrentStep('');
                                setStreamingContent('');

                                // Add assistant message
                                const assistantMessage: Message = {
                                    id: `msg-${Date.now()}-assistant`,
                                    role: 'assistant',
                                    content: event.content || 'No response received.',
                                };
                                setMessages(prev => [...prev, assistantMessage]);
                            }
                        } catch (parseError) {
                            console.error('Failed to parse SSE event:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}-error`,
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
            }]);
            setCurrentStep('');
            setStreamingContent('');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (text: string) => {
        setInput(text);
        setTimeout(() => {
            const form = document.querySelector('form');
            if (form) form.requestSubmit();
        }, 0);
    };

    // Show loading while checking auth
    if (isCheckingAuth) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">Checking session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

            {/* Fixed Header */}
            <header className="flex-none sticky top-0 z-10 flex items-center gap-3 px-4 h-14 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <h1 className="text-lg font-semibold mr-auto">AI Network Assistant</h1>

                {/* New Chat button */}
                {messages.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNewChat}
                        title="New Chat"
                    >
                        <RotateCcw className="size-5" />
                        <span className="sr-only">New Chat</span>
                    </Button>
                )}

                {/* Logout button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                        await fetch('/api/auth/logout', { method: 'POST' });
                        router.push('/setup');
                    }}
                    title="Logout"
                >
                    <LogOut className="size-5" />
                    <span className="sr-only">Logout</span>
                </Button>

                {/* Theme toggle */}
                <ModeToggle />
            </header>

            {/* Scrollable Message Area */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                    <div className="max-w-3xl mx-auto space-y-6 pb-4">
                        {messages.length === 0 && !currentStep && !streamingContent && (
                            <EmptyState onSuggestionClick={handleSuggestionClick} />
                        )}

                        {messages.map((message) => (
                            <ChatMessage key={message.id} message={message} />
                        ))}

                        {/* Streaming content - shows while receiving response */}
                        {isLoading && streamingContent && (
                            <div className="flex gap-4 w-full justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Avatar className="size-8 border mt-1">
                                    <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                                </Avatar>
                                <div className="bg-muted border px-4 py-3 rounded-2xl rounded-tl-sm max-w-[85%]">
                                    <div className="prose prose-sm dark:prose-invert">
                                        {streamingContent}
                                        <span className="inline-block size-2 bg-primary/50 animate-pulse ml-0.5" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reasoning Trace - shows while processing */}
                        {isLoading && currentStep && !streamingContent && (
                            <ReasoningTrace
                                currentStep={currentStep}
                                isActive={true}
                            />
                        )}

                        {/* Simple loading indicator when no steps yet */}
                        {isLoading && !currentStep && !streamingContent && (
                            <div className="flex gap-4 w-full justify-start">
                                <Avatar className="size-8 border mt-1">
                                    <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                                </Avatar>
                                <div className="bg-muted border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                                    <div className="flex space-x-1">
                                        <div className="size-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="size-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="size-2 bg-foreground/40 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>
            </div>

            {/* Fixed Footer - Input */}
            <div className="flex-none bg-background pb-4">
                <ChatInput
                    input={input}
                    setInput={setInput}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
}
