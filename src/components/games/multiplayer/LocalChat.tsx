import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GameMessage } from '@/lib/localNetwork';
import { cn } from '@/lib/utils';

interface LocalChatProps {
  messages: GameMessage[];
  localId: string;
  onSendMessage: (text: string) => void;
  className?: string;
}

const LocalChat = ({ messages, localId, onSendMessage, className }: LocalChatProps) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatMessages = messages.filter(m => m.type === 'chat');

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Local Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-48 px-4" ref={scrollRef}>
              {chatMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No messages yet
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {chatMessages.map((msg, index) => {
                const isLocal = msg.senderId === localId;
                const isClue = msg.payload?.kind === 'clue';
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex flex-col",
                      isLocal ? "items-end" : "items-start"
                    )}
                  >
                    <span className="text-xs text-muted-foreground mb-0.5">
                      {msg.senderName}{isClue ? ' • Clue' : ''}
                    </span>
                    <div
                      className={cn(
                        "px-3 py-2 rounded-lg max-w-[80%] text-sm",
                        isLocal ? "bg-primary text-primary-foreground" : isClue ? "bg-amber-500/10 text-amber-700" : "bg-muted"
                      )}
                    >
                      {msg.payload.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="p-3 border-t border-border flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default LocalChat;
