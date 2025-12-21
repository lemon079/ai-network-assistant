import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ChatMessageProps {
    message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === 'user';

    return (
        <div className={cn("flex gap-4 w-full", isUser ? "justify-end" : "justify-start")}>
            {!isUser && (
                <Avatar className="size-8 border mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground">AI</AvatarFallback>
                </Avatar>
            )}

            <div
                className={cn(
                    "relative px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-sm",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm border"
                )}
            >
                {!isUser ? (
                    <div className="chat-markdown max-w-none wrap-break-word">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                                table: ({ children }) => (
                                    <div className="overflow-x-auto my-3">
                                        <table className="min-w-full border-collapse border border-border rounded-lg text-sm">
                                            {children}
                                        </table>
                                    </div>
                                ),
                                thead: ({ children }) => (
                                    <thead className="bg-muted/50">{children}</thead>
                                ),
                                th: ({ children }) => (
                                    <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>
                                ),
                                td: ({ children }) => (
                                    <td className="border border-border px-3 py-2">{children}</td>
                                ),
                                tr: ({ children }) => (
                                    <tr className="hover:bg-muted/30">{children}</tr>
                                ),
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <div className="whitespace-pre-wrap wrap-break-words">{message.content}</div>
                )}
            </div>

            {isUser && (
                <Avatar className="size-8 border mt-1">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">U</AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}
