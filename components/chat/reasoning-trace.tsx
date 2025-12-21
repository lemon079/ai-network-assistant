'use client';

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ReasoningTraceProps {
    currentStep: string;
    isActive: boolean;
    className?: string;
}

/**
 * Displays the current reasoning step while the AI agent is processing.
 * Shows only the active step with a smooth transition.
 */
export function ReasoningTrace({ currentStep, isActive, className }: ReasoningTraceProps) {
    if (!isActive || !currentStep) return null;

    return (
        <div className={cn("flex gap-4 w-full justify-start animate-in fade-in slide-in-from-bottom-2 duration-300", className)}>
            <Avatar className="size-8 border mt-1">
                <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
            </Avatar>

            <div className="bg-linear-to-r from-muted/60 to-muted/30 border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="animate-pulse">{currentStep}</span>
                </div>
            </div>
        </div>
    );
}
