import { useState } from "react";
import { 
  Trophy, ChevronUp, ChevronDown, Crown, Medal, Award, WifiOff, User, 
  Flame, Target, Gamepad2, TrendingUp, Sparkles
} from "lucide-react";
import { useLeaderboard, AggregatedScore } from "@/hooks/useBibleGames";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface FloatingLeaderboardProps {
  gameType?: string;
  className?: string;
  sessionScores?: AggregatedScore[];
}

const FloatingLeaderboard = ({ gameType: initialGameType, className, sessionScores }: FloatingLeaderboardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const { user } = useAuth();
  
  const filterType = selectedFilter === "all" ? undefined : selectedFilter;
  const fetched = useLeaderboard(filterType);

  // If a sessionScores prop is provided (local multiplayer), show those instead
  const scores = sessionScores ?? fetched.scores;
  const loading = sessionScores ? false : fetched.loading;
  const isOnline = sessionScores ? true : fetched.isOnline;

  // Find current user's rank
  const userRank = scores.findIndex(s => s.user_id === user?.id) + 1;
  const userScore = scores.find(s => s.user_id === user?.id);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="relative">
            <Crown className="w-5 h-5 text-yellow-500 animate-pulse" />
            <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
          </div>
        );
      case 1:
        return <Medal className="w-5 h-5 text-slate-400" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return (
          <span className="text-sm font-bold text-muted-foreground w-5 h-5 flex items-center justify-center">
            {index + 1}
          </span>
        );
    }
  };

  const getRankBackground = (index: number) => {
    switch (index) {
      case 0:
        return "bg-gradient-to-r from-yellow-500/20 via-yellow-400/10 to-transparent border-yellow-500/30";
      case 1:
        return "bg-gradient-to-r from-slate-400/20 via-slate-300/10 to-transparent border-slate-400/30";
      case 2:
        return "bg-gradient-to-r from-amber-600/20 via-amber-500/10 to-transparent border-amber-600/30";
      default:
        return "bg-card/50 border-border/50";
    }
  };

  const maxScore = scores[0]?.total_score || 1;

  return (
    <div
      className={cn(
        "fixed right-4 bottom-20 z-40 transition-all duration-500 ease-out",
        isExpanded ? "w-80" : "w-auto",
        className
      )}
    >
      <div className="bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent hover:from-primary/30 hover:via-primary/15 transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Trophy className="w-5 h-5 text-primary" />
              {scores.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="font-semibold text-sm">Leaderboard</span>
            {!isExpanded && scores.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {scores.length} players
              </span>
            )}
          </div>
          <div className={cn(
            "transition-transform duration-300",
            isExpanded ? "rotate-180" : ""
          )}>
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="animate-in slide-in-from-top-2 duration-300">
            {/* Filter Tabs */}
            <div className="px-3 pt-2">
              <Tabs value={selectedFilter} onValueChange={setSelectedFilter}>
                <TabsList className="w-full grid grid-cols-3 h-8">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="trivia" className="text-xs">Trivia</TabsTrigger>
                  <TabsTrigger value="guess_character" className="text-xs">Character</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Your Rank Card - Only show if user is logged in and has a score */}
            {user && userScore && (
              <div className="mx-3 mt-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
                    #{userRank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Your Rank</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {userScore.total_score} pts
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {userScore.highest_streak} streak
                      </span>
                    </div>
                  </div>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
              </div>
            )}

            {/* Leaderboard List */}
            <div className="p-3 max-h-72 overflow-y-auto scrollbar-thin">
              {!isOnline ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <WifiOff className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm text-center font-medium">You're offline</p>
                  <p className="text-xs text-center mt-1">
                    Leaderboard available when online
                  </p>
                </div>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Loading rankings...</p>
                </div>
              ) : scores.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <div className="relative">
                    <Trophy className="w-12 h-12 mb-3 opacity-30" />
                    <Gamepad2 className="w-6 h-6 absolute -bottom-1 -right-1 text-primary" />
                  </div>
                  <p className="text-sm text-center font-medium">No scores yet</p>
                  <p className="text-xs text-center mt-1">
                    Play a game to get on the leaderboard!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scores.map((score, index) => (
                    <div
                      key={score.user_id}
                      className={cn(
                        "relative flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300 hover:scale-[1.02]",
                        getRankBackground(index),
                        score.user_id === user?.id && "ring-2 ring-primary/50"
                      )}
                      style={{
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      {/* Rank Icon */}
                      <div className="flex items-center justify-center w-8">
                        {getRankIcon(index)}
                      </div>

                      {/* Avatar */}
                      <Avatar className="w-9 h-9 border-2 border-background shadow-sm">
                        <AvatarImage src={score.profiles?.avatar_url || undefined} />
                        <AvatarFallback className={cn(
                          "text-xs font-bold",
                          index === 0 ? "bg-yellow-500/30 text-yellow-700" :
                          index === 1 ? "bg-slate-400/30 text-slate-700" :
                          index === 2 ? "bg-amber-600/30 text-amber-800" :
                          "bg-primary/20 text-primary"
                        )}>
                          {score.profiles?.username?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                        </AvatarFallback>
                      </Avatar>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">
                            {score.profiles?.username || 'Anonymous'}
                          </p>
                          {score.user_id === user?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Gamepad2 className="w-3 h-3" />
                            {score.total_games_played} games
                          </span>
                          <span className="text-[10px] text-orange-500 flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            {score.highest_streak}
                          </span>
                        </div>
                        {/* Score Progress Bar */}
                        <div className="mt-1.5">
                          <Progress 
                            value={(score.total_score / maxScore) * 100} 
                            className="h-1"
                          />
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right pl-2">
                        <p className={cn(
                          "text-lg font-bold",
                          index === 0 ? "text-yellow-500" :
                          index === 1 ? "text-slate-400" :
                          index === 2 ? "text-amber-600" :
                          "text-primary"
                        )}>
                          {score.total_score.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">points</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {isOnline && (
              <div className="px-3 pb-3 pt-1">
                <div className="text-center py-2 border-t border-border">
                  {user ? (
                    !userScore && (
                      <p className="text-xs text-muted-foreground">
                        🎮 Play games to climb the ranks!
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      ✨ Sign in to save your scores!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingLeaderboard;
