import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
}

export function ChatInput({ input, setInput, onSubmit, isLoading }: ChatInputProps) {

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
        }
        if (e.key === 'Enter' && e.shiftKey) {
            e.stopPropagation();
        }
    };

    return (
        <div className="p-4 border-t bg-background">
            <div className="max-w-3xl mx-auto">
                <form onSubmit={onSubmit} className="relative flex items-end w-full p-2 border rounded-xl bg-muted/50 focus-within:ring-1 focus-within:ring-ring">
                    <TextareaAutosize
                        className="w-full resize-none border-0 bg-transparent shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-2 text-base md:text-sm 
                        transition-[height] duration-200 ease-in-out
                        [&::-webkit-scrollbar]"
                        value={input}
                        placeholder="Send a message..."
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        minRows={1}
                        maxRows={8}
                        rows={1}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading || !input.trim()}
                        className="mb-1 ml-2 size-8 shrink-0 rounded-full"
                    >
                        <Send className="size-4" />
                        <span className="sr-only">Send</span>
                    </Button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-muted-foreground">
                        AI Network Assistant can make mistakes. Check important info.
                    </p>
                </div>
            </div>
        </div>
    );
}