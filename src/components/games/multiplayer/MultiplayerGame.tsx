import { useState, useEffect, useCallback } from 'react';
import { Trophy, Clock, Users, CheckCircle, XCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BibleGame } from '@/hooks/useBibleGames';
import { GameRoom, LocalPeer, GameMode } from '@/lib/localNetwork';
import { MultiplayerGameState } from '@/hooks/useLocalMultiplayer';
import { cn } from '@/lib/utils';
import ClueDialog from './ClueDialog';
import { toast } from '@/hooks/use-toast';

interface MultiplayerGameProps {
  room: GameRoom;
  gameState: MultiplayerGameState;
  questions: BibleGame[];
  localId: string;
  isHost: boolean;
  onSubmitAnswer: (answer: string) => void;
  onUpdateScores: (scores: Record<string, number>, phase?: string, roundWinner?: string) => void;
  onSendQuestion: (question: any, index: number, timer?: number) => void;
  onGameEnd: () => void;
  onSendClue?: (text: string) => void;
}

const MultiplayerGame = ({
  room,
  gameState,
  questions,
  localId,
  isHost,
  onSubmitAnswer,
  onUpdateScores,
  onSendQuestion,
  onGameEnd,
  onSendClue
}: MultiplayerGameProps) => {
  const [timer, setTimer] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showClueDialog, setShowClueDialog] = useState(false);

  const currentQuestion = gameState.currentQuestion;
  const currentIndex = gameState.currentQuestionIndex;
  const isCompetitive = room.gameMode === 'competitive';

  // Timer countdown
  useEffect(() => {
    if (gameState.phase !== 'question') return;
    
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Time's up - show results
          if (isHost) {
            calculateRoundResults();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.phase, currentIndex, isHost]);

  // Reset state for new question
  useEffect(() => {
    setTimer(30);
    setSelectedAnswer(null);
    setHasAnswered(false);
  }, [currentIndex]);

  // Calculate round results (host only)
  const calculateRoundResults = useCallback(() => {
    if (!isHost) return;

    const correctAnswer = currentQuestion?.correct_answer;
    const newScores = { ...gameState.scores };
    let roundWinner: string | undefined;

    if (isCompetitive) {
      // First correct answer wins
      const sortedAnswers = Object.entries(gameState.answers)
        .filter(([_, answer]) => answer === correctAnswer)
        .sort((a, b) => 0); // In real implementation, sort by timestamp

      if (sortedAnswers.length > 0) {
        roundWinner = sortedAnswers[0][0];
        newScores[roundWinner] = (newScores[roundWinner] || 0) + (currentQuestion?.points || 10);
      }
    } else {
      // Cooperative - everyone who got it right gets points
      Object.entries(gameState.answers).forEach(([playerId, answer]) => {
        if (answer === correctAnswer) {
          newScores[playerId] = (newScores[playerId] || 0) + (currentQuestion?.points || 10);
        }
      });
    }

    onUpdateScores(newScores, 'results', roundWinner);
  }, [isHost, currentQuestion, gameState.answers, gameState.scores, isCompetitive, onUpdateScores]);

  // Check if all players answered
  useEffect(() => {
    if (gameState.phase !== 'question' || !isHost) return;
    
    const allAnswered = room.currentPlayers.every(p => gameState.answers[p.id]);
    if (allAnswered) {
      calculateRoundResults();
    }
  }, [gameState.answers, room.currentPlayers, isHost, calculateRoundResults, gameState.phase]);

  const handleSelectAnswer = (answer: string) => {
    if (hasAnswered || gameState.phase !== 'question') return;
    setSelectedAnswer(answer);
    setHasAnswered(true);
    onSubmitAnswer(answer);
  };

  const handleNextQuestion = () => {
    if (!isHost) return;

    if (currentIndex >= questions.length - 1) {
      onUpdateScores(gameState.scores, 'finished');
      return;
    }

    const nextQuestion = questions[currentIndex + 1];
    onSendQuestion(nextQuestion, currentIndex + 1, 30);
  };

  // Finished state
  if (gameState.phase === 'finished') {
    const sortedScores = Object.entries(gameState.scores)
      .sort(([, a], [, b]) => b - a);
    
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center">
          <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold mb-6">Game Over! 🎉</h2>
          
          <div className="space-y-3 mb-6">
            {sortedScores.map(([playerId, score], index) => {
              const player = room.currentPlayers.find(p => p.id === playerId);
              return (
                <div
                  key={playerId}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    index === 0 && "bg-amber-500/10 border-2 border-amber-500/30"
                  )}
                >
                  <span className="text-lg font-bold w-6">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {player?.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium text-left">
                    {player?.name}
                    {playerId === localId && " (You)"}
                  </span>
                  <span className="font-bold text-primary">{score} pts</span>
                </div>
              );
            })}
          </div>

          <Button onClick={onGameEnd} className="w-full">
            Back to Lobby
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Results phase
  if (gameState.phase === 'results') {
    const correctAnswer = currentQuestion?.correct_answer;
    
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-center">Round Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Correct Answer */}
          <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Correct Answer</p>
            <p className="text-lg font-bold text-green-500">{correctAnswer}</p>
          </div>

          {/* Round Winner (competitive mode) */}
          {isCompetitive && gameState.roundWinner && (
            <div className="text-center p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Crown className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="font-medium">
                {room.currentPlayers.find(p => p.id === gameState.roundWinner)?.name} wins this round!
              </p>
            </div>
          )}

          {/* Player Answers */}
          <div className="space-y-2">
            {room.currentPlayers.map(player => {
              const answer = gameState.answers[player.id];
              const isCorrect = answer === correctAnswer;
              
              return (
                <div
                  key={player.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg",
                    isCorrect ? "bg-green-500/10" : "bg-red-500/10"
                  )}
                >
                  {isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="flex-1">{player.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {answer || 'No answer'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Current Scores */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-2">Scores</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(gameState.scores)
                .sort(([, a], [, b]) => b - a)
                .map(([playerId, score]) => {
                  const player = room.currentPlayers.find(p => p.id === playerId);
                  return (
                    <div key={playerId} className="px-3 py-1 bg-muted rounded-full text-sm">
                      {player?.name}: <span className="font-bold">{score}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Next Question Button (host only) */}
          {isHost && (
            <Button onClick={handleNextQuestion} className="w-full">
              {currentIndex >= questions.length - 1 ? 'See Final Results' : 'Next Question'}
            </Button>
          )}

          {!isHost && (
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                Waiting for host to continue...
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    // Ask host to return to lobby
                    // Broadcast a lobby_request on data channel
                    // We emit a custom event via window so the hook can pick it up via connection manager
                    const event = new CustomEvent('multiplayer-lobby-request');
                    window.dispatchEvent(event);
                  }}
                  variant="ghost"
                >
                  Return to Lobby
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Question phase
  if (!currentQuestion) return null;

  return (
    <div className="space-y-4">
      {/* Timer and Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-2">
            <Clock className={cn(
              "w-4 h-4",
              timer <= 10 ? "text-red-500 animate-pulse" : "text-muted-foreground"
            )} />
            <span className={cn(
              "font-bold",
              timer <= 10 && "text-red-500"
            )}>
              {timer}s
            </span>
          </div>
        </div>
        <Progress value={(timer / 30) * 100} className="h-2" />
      </div>

      {/* Players Status */}
      <div className="flex gap-2 flex-wrap">
        {room.currentPlayers.map(player => {
          const hasAnswered = !!gameState.answers[player.id];
          return (
            <div
              key={player.id}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
                hasAnswered ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
              )}
            >
              {hasAnswered ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {player.name}
            </div>
          );
        })}
      </div>

      {/* Question Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              currentQuestion.difficulty === 'easy' && "bg-green-500/20 text-green-500",
              currentQuestion.difficulty === 'medium' && "bg-yellow-500/20 text-yellow-500",
              currentQuestion.difficulty === 'hard' && "bg-red-500/20 text-red-500"
            )}>
              {currentQuestion.difficulty}
            </span>
            <span className="text-xs text-muted-foreground">
              +{currentQuestion.points} pts
            </span>
          </div>
          <CardTitle className="text-lg leading-relaxed">
            {currentQuestion.question}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentQuestion.options?.map((option: string, index: number) => (
            <button
              key={index}
              onClick={() => handleSelectAnswer(option)}
              disabled={hasAnswered}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all duration-200 border-2",
                !hasAnswered && "hover:border-primary hover:bg-primary/5 border-border",
                hasAnswered && option === selectedAnswer && "border-primary bg-primary/10",
                hasAnswered && option !== selectedAnswer && "border-border opacity-50"
              )}
            >
              <span className="font-medium">{option}</span>
            </button>
          ))}

          {hasAnswered && (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Answer submitted! Waiting for others...
              </p>
            </div>
          )}

          {/* Cooperative clue button */}
          {!isCompetitive && onSendClue && (
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => setShowClueDialog(true)}
                className="w-full"
              >
                Give Clue
              </Button>
            </div>
          )}

          <ClueDialog
            open={showClueDialog}
            onOpenChange={setShowClueDialog}
            onSend={(text) => {
              onSendClue?.(text);
              toast({ title: 'Clue sent', description: text });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiplayerGame;
