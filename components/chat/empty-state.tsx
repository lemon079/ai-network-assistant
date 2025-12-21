import { Card } from "@/components/ui/card";
import { Search, Radio, Wifi, Globe, LucideIcon } from "lucide-react";

interface EmptyStateProps {
    onSuggestionClick: (text: string) => void;
}

interface Suggestion {
    icon: LucideIcon;
    text: string;
    desc: string;
}

const suggestions: Suggestion[] = [
    { icon: Search, text: 'Show my network information', desc: 'View IP, MAC, and gateway' },
    { icon: Radio, text: 'Scan my network for devices', desc: 'Discover connected devices' },
    { icon: Wifi, text: "What's my WiFi signal strength?", desc: 'Check WiFi connection' },
    { icon: Globe, text: 'Ping google.com', desc: 'Test internet connectivity' },
];

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-8">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">How can I help you today?</h2>
                <p className="text-muted-foreground">Ask me anything about networking, troubleshooting, or IT support.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {suggestions.map((suggestion, index) => (
                    <Card
                        key={index}
                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors text-left group border-muted"
                        onClick={() => onSuggestionClick(suggestion.text)}
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                <suggestion.icon className="size-5" />
                            </div>
                            <div>
                                <div className="font-medium">{suggestion.text}</div>
                                <div className="text-xs text-muted-foreground mt-1">{suggestion.desc}</div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
