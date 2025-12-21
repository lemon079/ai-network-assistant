import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatHistory {
    id: string;
    title: string;
    timestamp: Date;
}

interface SidebarProps {
    chatHistory: ChatHistory[];
    currentChatId: string;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string, e: React.MouseEvent) => void;
    className?: string;
}

export function ChatSidebar({
    chatHistory,
    currentChatId,
    onNewChat,
    onSelectChat,
    onDeleteChat,
    className
}: SidebarProps) {
    return (
        <div className={cn("flex flex-col h-full", className)}>
            <div className="p-4 border-b">
                <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="default">
                    <Plus className="size-4" /> New Chat
                </Button>
            </div>
            <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground px-2 py-2">Recent Chats</h3>
                    {chatHistory.length === 0 && (
                        <p className="text-sm text-muted-foreground px-2">No recent chats</p>
                    )}
                    {chatHistory.map((chat) => (
                        <Button
                            key={chat.id}
                            variant={chat.id === currentChatId ? "secondary" : "ghost"}
                            className="w-full justify-start text-left font-normal group relative pr-8"
                            onClick={() => onSelectChat(chat.id)}
                        >
                            <MessageSquare className="mr-2 size-4" />
                            <span className="truncate">{chat.title}</span>
                            <div
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background rounded-sm cursor-pointer"
                                onClick={(e) => onDeleteChat(chat.id, e)}
                            >
                                <X className="size-3 text-muted-foreground" />
                            </div>
                        </Button>
                    ))}
                </div>
            </ScrollArea>
            <div className="p-4 border-t mt-auto">
                <div className="flex items-center gap-3 px-2">
                    <Avatar className="size-8">
                        <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">User</span>
                        <span className="text-xs text-muted-foreground">Free Plan</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
