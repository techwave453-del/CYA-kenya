import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const FloatingActionButton = () => {
  const navigate = useNavigate();
  
  return (
    <button 
      onClick={() => navigate("/chat")} 
      className={cn(
        "fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground",
        "flex items-center justify-center shadow-lg",
        "hover:scale-110 active:scale-95 transition-all duration-200",
        "animate-pulse-glow"
      )}
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
};
export default FloatingActionButton;