import { useState, useMemo } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LocalChat from './LocalChat';
import { cn } from '@/lib/utils';

interface FloatingChatProps {
  messages: any[];
  localId: string;
  onSendMessage: (text: string) => void;
}

const FloatingChat = ({ messages, localId, onSendMessage }: FloatingChatProps) => {
  const [open, setOpen] = useState(false);

  const unread = useMemo(() => messages.filter(m => m.type === 'chat').length, [messages]);

  return (
    <div>
      {/* Chat Drawer */}
      <div className={cn(
        'fixed right-4 bottom-4 z-50 transition-all',
        open ? 'translate-y-0' : 'translate-y-0'
      )}>
        {open && (
          <div className="w-[320px] max-w-[90vw] mb-3">
            <LocalChat messages={messages} localId={localId} onSendMessage={onSendMessage} />
          </div>
        )}

        {/* Floating button */}
        <div className="flex items-end justify-end">
          <Button
            className="rounded-full p-3 shadow-lg"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close chat' : 'Open chat'}
          >
            {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            {!open && unread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-white text-xs px-2 py-0.5">
                {unread}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FloatingChat;
