import { useState, useEffect } from 'react';
import { Plus, Users, Wifi, Bluetooth, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocalMultiplayer } from '@/hooks/useLocalMultiplayer';
import { useBibleGames, BibleGame } from '@/hooks/useBibleGames';
import GameLobby from './GameLobby';
import CreateRoomDialog from './CreateRoomDialog';
import JoinRoomDialog from './JoinRoomDialog';
import FloatingChat from './FloatingChat';
import LocalChat from './LocalChat';
import MultiplayerGame from './MultiplayerGame';
import FloatingLeaderboard from '@/components/games/FloatingLeaderboard';
import { cn } from '@/lib/utils';

interface MultiplayerModeProps {
  onBack: () => void;
}

const MultiplayerMode = ({ onBack }: MultiplayerModeProps) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  
  const {
    isHost,
    room,
    peers,
    messages,
    connectionStatus,
    gameState,
    localId,
    localName,
    createRoom,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    requestStartGame,
    updateRoomSettings,
    submitAnswer,
    updateScores,
    sendQuestion,
    sendClue,
    isWebRTCSupported,
    isBluetoothSupported,
    sharedQuestions
  } = useLocalMultiplayer();

  // Build session leaderboard from room or current game state
  const sessionScores = (() => {
    if (!room) return [];

    if (gameState?.scores) {
      return Object.entries(gameState.scores).map(([id, total_score]) => {
        const player = room.currentPlayers.find(p => p.id === id);
      return {
        user_id: id,
        total_score: total_score as number,
        total_games_played: 0,
        highest_streak: 0,
        games: [],
        profiles: { username: player?.name || 'Unknown', avatar_url: null }
      };
      }).sort((a, b) => b.total_score - a.total_score);
    }

    return room.currentPlayers.map(p => ({
      user_id: p.id,
      total_score: p.score || 0,
      total_games_played: 0,
      highest_streak: 0,
      games: [],
      profiles: { username: p.name, avatar_url: null }
    })).sort((a, b) => b.total_score - a.total_score);
  })();

  const { games: triviaGames } = useBibleGames('trivia');
  const { games: characterGames } = useBibleGames('guess_character');
  const { games: fillBlankGames } = useBibleGames('fill_blank');
  const { games: memoryVerseGames } = useBibleGames('memory_verse');
  const { games: allGames } = useBibleGames();

  // Prepare questions when starting game
  const handleStartGame = () => {
    let questions: BibleGame[] = [];
    
    if (!room) return;

    switch (room.gameType) {
      case 'trivia':
        questions = triviaGames;
        break;
      case 'guess_character':
        questions = characterGames;
        break;
      case 'fill_blank':
        questions = fillBlankGames;
        break;
      case 'memory_verse':
        questions = memoryVerseGames;
        break;
      case 'daily_challenge':
        // Daily: sample across categories for variety
        questions = [...triviaGames, ...characterGames, ...fillBlankGames, ...memoryVerseGames]
          .sort(() => Math.random() - 0.5);
        break;
      case 'all':
      default:
        questions = allGames.length ? allGames : [...triviaGames, ...characterGames, ...fillBlankGames, ...memoryVerseGames];
        questions = questions.sort(() => Math.random() - 0.5);
        break;
    }

    // Limit to 10 questions for multiplayer
    const perRound = room?.questionsPerRound || 10;
    questions = questions.slice(0, perRound);
    requestStartGame(questions);
  };

  const handleGameEnd = () => {
    // Host resets scores; sharedQuestions will be cleared when game state resets
    // Reset game state by leaving and rejoining would be handled by host
    if (isHost && room) {
      updateScores(
        room.currentPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}),
        'waiting'
      );
    }
  };

  // Not in a room - show options
  if (!room) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Multiplayer Games</h2>
          <p className="text-sm text-muted-foreground">
            Play Bible games with friends anywhere with internet
          </p>
        </div>

        {/* Connection Status */}
        <div className="flex justify-center gap-4 text-sm">
          <div className={cn(
            "flex items-center gap-1",
            isWebRTCSupported ? "text-green-500" : "text-red-500"
          )}>
            <Wifi className="w-4 h-4" />
            WiFi {isWebRTCSupported ? '✓' : '✗'}
          </div>
          <div className={cn(
            "flex items-center gap-1",
            isBluetoothSupported ? "text-green-500" : "text-muted-foreground"
          )}>
            <Bluetooth className="w-4 h-4" />
            Bluetooth {isBluetoothSupported ? '✓' : '(Limited)'}
          </div>
        </div>

        {!isWebRTCSupported && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="py-4 text-center">
              <WifiOff className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-500">
                Your browser doesn't support local multiplayer. Try Chrome or Edge.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Create/Join Options */}
        <div className="grid gap-4">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setShowCreateDialog(true)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Create Room</h3>
                <p className="text-sm text-muted-foreground">
                  Host a game for friends to join
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setShowJoinDialog(true)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-full bg-purple-500/10">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Join Room</h3>
                <p className="text-sm text-muted-foreground">
                  Enter a room code to join a game
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <div className="text-center space-y-2 pt-4">
          <h4 className="text-sm font-medium text-muted-foreground">How it works</h4>
          <ol className="text-xs text-muted-foreground space-y-1">
            <li>1. Make sure all devices have internet access</li>
            <li>2. One person creates a room and gets a code + passcode</li>
            <li>3. Others join using the room code and passcode</li>
            <li>4. Compete or cooperate in Bible trivia!</li>
          </ol>
        </div>

        <CreateRoomDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreate={createRoom}
        />
        
        <JoinRoomDialog
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          onJoin={joinRoom}
        />
      </div>
    );
  }

  // In a room but game not started
  if (room.status === 'waiting' || !gameState) {
    return (
      <div className="space-y-4">
        <GameLobby
          room={room}
          peers={peers}
          isHost={isHost}
          localId={localId}
          connectionStatus={connectionStatus}
          onStartGame={handleStartGame}
          onLeaveRoom={leaveRoom}
          onUpdateRoomSettings={updateRoomSettings}
        />

        <LocalChat
          messages={messages}
          localId={localId}
          onSendMessage={sendChatMessage}
        />
        <FloatingLeaderboard sessionScores={sessionScores} className="right-20 bottom-20" />
      </div>
    );
  }

  // Game in progress
  return (
    <div className="space-y-4 md:flex md:gap-4">
      <div className="flex-1">
        <MultiplayerGame
          room={room}
          gameState={gameState}
          questions={sharedQuestions}
          localId={localId}
          isHost={isHost}
          onSubmitAnswer={submitAnswer}
          onUpdateScores={updateScores}
          onSendQuestion={sendQuestion}
          onGameEnd={handleGameEnd}
          onSendClue={sendClue}
        />
      </div>

      <FloatingChat
        messages={messages}
        localId={localId}
        onSendMessage={sendChatMessage}
      />
      <FloatingLeaderboard sessionScores={sessionScores} className="right-20 bottom-20" />
    </div>
  );
};

export default MultiplayerMode;
