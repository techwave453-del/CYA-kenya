import { FileText, ListTodo, Activity, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useNewQuestionsCount } from "@/hooks/useNewQuestionsCount";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  route?: string;
}

const tabs: Tab[] = [
  { id: "posts", label: "Posts", icon: <FileText className="w-4 h-4" /> },
  { id: "tasks", label: "Tasks", icon: <ListTodo className="w-4 h-4" /> },
  { id: "activities", label: "Activities", icon: <Activity className="w-4 h-4" /> },
  { id: "games", label: "Games", icon: <Gamepad2 className="w-4 h-4" />, route: "/games" },
];
interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TabNavigation = ({ activeTab, onTabChange }: TabNavigationProps) => {
  const navigate = useNavigate();
  const { newCount } = useNewQuestionsCount();

  const handleTabClick = (tab: Tab) => {
    if (tab.route) {
      navigate(tab.route);
    } else {
      onTabChange(tab.id);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab)}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap",
            activeTab === tab.id
              ? "bg-primary text-primary-foreground glow-gold"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.id === 'games' && newCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {newCount > 9 ? "9+" : newCount}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;
