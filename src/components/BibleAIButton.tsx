import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
 import { BookOpen } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import BibleAIChat from './BibleAIChat';
 
 const BibleAIButton = () => {
   const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
 
   return (
     <>
      <button 
        onClick={() => {
          // If user is on the chat page, open the AI conversation there instead
          if (location.pathname === '/chat') {
            navigate('/chat', { state: { openAI: true } });
            return;
          }
          setIsOpen(true);
        }} 
         className={cn(
           "fixed bottom-24 right-6 w-14 h-14 rounded-full",
           "bg-secondary text-secondary-foreground",
           "flex items-center justify-center shadow-lg",
           "hover:scale-110 active:scale-95 transition-all duration-200",
           "z-40"
         )}
         aria-label="Open Bible AI Assistant"
       >
         <BookOpen className="w-6 h-6" />
       </button>

      <BibleAIChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
     </>
   );
 };
 
 export default BibleAIButton;