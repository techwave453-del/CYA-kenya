import { useState, useCallback, useRef, useEffect } from 'react';
import {
  PeerConnectionManager,
  LocalPeer,
  GameRoom,
  GameMessage,
  GameMode,
  generateRoomCode,
  generatePasscode,
  isValidPasscode,
  isWebRTCAvailable,
  isBluetoothAvailable
} from '@/lib/localNetwork';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface MultiplayerState {
  isHost: boolean;
  room: GameRoom | null;
  peers: LocalPeer[];
  messages: GameMessage[];
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  gameState: MultiplayerGameState | null;
  sharedQuestions: any[];
}

export interface MultiplayerGameState {
  currentQuestionIndex: number;
  currentQuestion: any;
  scores: Record<string, number>;
  answers: Record<string, string>;
  phase: 'waiting' | 'question' | 'results' | 'leaderboard' | 'finished';
  timer: number;
  roundWinner?: string;
}

export const useLocalMultiplayer = () => {
  const { user, profile } = useAuth();
  const [state, setState] = useState<MultiplayerState>({
    isHost: false,
    room: null,
    peers: [],
    messages: [],
    connectionStatus: 'disconnected',
    gameState: null,
    sharedQuestions: []
  });

  const connectionManager = useRef<PeerConnectionManager | null>(null);
  const localId = useRef<string>(user?.id || crypto.randomUUID());
  const localName = useRef<string>(profile?.username || 'Player');

  // Update local name when profile changes
  useEffect(() => {
    if (profile?.username) {
      localName.current = profile.username;
    }
  }, [profile?.username]);

  // Create a new game room (host)
  const createRoom = useCallback((
    gameType: 'trivia' | 'guess_character' | 'fill_blank' | 'memory_verse' | 'daily_challenge' | 'all',
    gameMode: GameMode,
    gameName: string,
    maxPlayers: number = 4
  ) => {
    if (!isWebRTCAvailable()) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support local multiplayer",
        variant: "destructive"
      });
      return null;
    }

    const roomId = generateRoomCode();
    const room: GameRoom = {
      id: roomId,
      passcode: generatePasscode(),
      hostId: localId.current,
      hostName: localName.current,
      gameName,
      gameType,
      gameMode,
      maxPlayers,
      currentPlayers: [{
        id: localId.current,
        name: localName.current,
        connectionMethod: 'wifi',
        isHost: true,
        score: 0,
        ready: true
      }],
      status: 'waiting',
      questionsPerRound: maxPlayers >= 1 ? 10 : 10,
      createdAt: Date.now()
    };

    // Initialize connection manager
    connectionManager.current = new PeerConnectionManager(roomId, localId.current, localName.current);
    
    // Setup event handlers
    connectionManager.current.onPeerConnected((peer) => {
      setState(prev => {
        const updatedRoom = prev.room ? {
          ...prev.room,
          currentPlayers: [...prev.room.currentPlayers, peer]
        } : null;
        
        // Send room update to the newly connected peer (and all others)
        if (updatedRoom) {
          setTimeout(() => {
            connectionManager.current?.broadcast({
              type: 'room_update',
              senderId: localId.current,
              senderName: localName.current,
              payload: { room: updatedRoom }
            });
          }, 100);
        }
        
        toast({
          title: "Player Joined! 🎮",
          description: `${peer.name} has joined the game`
        });
        
        return {
          ...prev,
          peers: [...prev.peers, peer],
          room: updatedRoom
        };
      });
    });

    connectionManager.current.onPeerDisconnected((peerId) => {
      setState(prev => ({
        ...prev,
        peers: prev.peers.filter(p => p.id !== peerId),
        room: prev.room ? {
          ...prev.room,
          currentPlayers: prev.room.currentPlayers.filter(p => p.id !== peerId)
        } : null
      }));
      
      toast({
        title: "Player Left",
        description: "A player has disconnected",
        variant: "destructive"
      });
    });

    connectionManager.current.onMessage((peerId, message) => {
      handleMessage(peerId, message);
    });

    setState({
      isHost: true,
      room,
      peers: [],
      messages: [],
      connectionStatus: 'connected',
      gameState: null,
      sharedQuestions: []
    });

    // Host announces presence so guests can discover them
    // Fire and forget - the announcement will set up periodically
    connectionManager.current.announce().catch(err => {
      console.error('Error announcing room:', err);
    });

    return roomId;
  }, []);

  // Update room settings (host only) and broadcast to peers
  const updateRoomSettings = useCallback((settings: Partial<GameRoom>) => {
    if (!state.isHost || !connectionManager.current) return;

    setState(prev => {
      const updatedRoom = prev.room ? { ...prev.room, ...settings } : prev.room;
      if (updatedRoom) {
        connectionManager.current?.broadcast({
          type: 'room_update',
          senderId: localId.current,
          senderName: localName.current,
          payload: { room: updatedRoom }
        });
      }
      return { ...prev, room: updatedRoom };
    });
  }, [state.isHost]);

  // Join an existing room (guest)
  const joinRoom = useCallback(async (roomCode: string, passcode: string) => {
    if (!isWebRTCAvailable()) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support local multiplayer",
        variant: "destructive"
      });
      return false;
    }

    // Validate passcode format
    if (!isValidPasscode(passcode)) {
      toast({
        title: "Invalid Passcode",
        description: "Passcode must be 4 digits",
        variant: "destructive"
      });
      return false;
    }

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }));

    // Initialize connection manager
    connectionManager.current = new PeerConnectionManager(roomCode, localId.current, localName.current);
    
    connectionManager.current.onPeerConnected((peer) => {
      setState(prev => {
        // Add peer to local list; don't assume role here. We'll request room info from host separately.
        const updatedPeer = { ...peer, isHost: false };
        return {
          ...prev,
          peers: [...prev.peers, updatedPeer],
          connectionStatus: 'connected'
        };
      });
      // Ask the newly connected peer for room info (host will respond if it's the host)
      setTimeout(() => {
        connectionManager.current?.sendTo(peer.id, {
          type: 'request_room_info',
          senderId: localId.current,
          senderName: localName.current,
          payload: { passcode }
        });
      }, 50);
    });

    connectionManager.current.onPeerDisconnected((peerId) => {
      setState(prev => ({
        ...prev,
        peers: prev.peers.filter(p => p.id !== peerId)
      }));
    });

    connectionManager.current.onMessage((peerId, message) => {
      handleMessage(peerId, message);
    });

    // Announce presence and wait for signaling to be ready
    await connectionManager.current.announce();

    // After announcing, wait briefly for any data channels to open and request room info from each connected peer.
    setTimeout(() => {
      // Send request_room_info to any currently-open peers directly; as new peers connect they'll also be asked in onPeerConnected
      connectionManager.current?.broadcast({
        type: 'request_room_info',
        senderId: localId.current,
        senderName: localName.current,
        payload: { passcode }
      });
    }, 500);

    // Wait for connection
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      let lastPeerCount = 0;
      
      const timeout = setTimeout(() => {
        if (!resolved && connectionManager.current?.getConnectedPeerCount() === 0) {
          resolved = true;
          console.error('Connection timeout - no peers connected after 30s');
          toast({
            title: "Connection Failed",
            description: "Couldn't find the game room. Check that you have internet, the room code is correct, and the passcode matches.",
            variant: "destructive"
          });
          connectionManager.current?.close();
          connectionManager.current = null;
          setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
          resolve(false);
        }
      }, 30000); // 30 seconds for full WebRTC handshake

      const checkConnection = setInterval(() => {
        if (!resolved && connectionManager.current) {
          const peerCount = connectionManager.current.getConnectedPeerCount();
          
          // Log status updates every 3 seconds
          if (peerCount !== lastPeerCount) {
            console.log(`Connection status: ${peerCount} peers connected`);
            lastPeerCount = peerCount;
          }
          
          if (peerCount > 0) {
            resolved = true;
            clearTimeout(timeout);
            clearInterval(checkConnection);
            
            console.log('Successfully connected to peer, setting up game state');
            
            // Create local player and add to room
            const localPlayer: LocalPeer = {
              id: localId.current,
              name: localName.current,
              connectionMethod: 'wifi',
              isHost: false,
              score: 0,
              ready: true
            };
            
            setState(prev => ({
              ...prev,
              isHost: false,
              connectionStatus: 'connected',
              room: prev.room ? {
                ...prev.room,
                currentPlayers: [...prev.room.currentPlayers, localPlayer]
              } : null
            }));
            
            toast({
              title: "Connected! 🎮",
              description: "You've joined the game"
            });
            resolve(true);
          }
        }
      }, 300); // Check connection status every 300ms
    });
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((peerId: string, message: GameMessage) => {
    setState(prev => {
      switch (message.type) {
        case 'chat':
          return {
            ...prev,
            messages: [...prev.messages, message]
          };

        case 'room_update':
          return {
            ...prev,
            room: message.payload.room
          };

        case 'game_start':
          return {
            ...prev,
            gameState: message.payload.gameState,
            sharedQuestions: message.payload.questions || []
          };

        case 'question':
          return {
            ...prev,
            gameState: prev.gameState ? {
              ...prev.gameState,
              currentQuestion: message.payload.question,
              currentQuestionIndex: message.payload.index,
              phase: 'question',
              timer: message.payload.timer,
              answers: {}
            } : null
          };

        case 'answer':
          return {
            ...prev,
            gameState: prev.gameState ? {
              ...prev.gameState,
              answers: {
                ...prev.gameState.answers,
                [message.senderId]: message.payload.answer
              }
            } : null
          };

        case 'score_update':
          return {
            ...prev,
            gameState: prev.gameState ? {
              ...prev.gameState,
              scores: message.payload.scores,
              phase: message.payload.phase || prev.gameState.phase,
              roundWinner: message.payload.roundWinner
            } : null
          };

        case 'request_room_info':
          // Host should send room info to requesting guest (with passcode validation)
          if (prev.isHost && prev.room && connectionManager.current) {
            const guestPasscode = message.payload.passcode;
            const roomPasscode = prev.room.passcode;
            
            // Validate passcode
            if (guestPasscode === roomPasscode) {
              connectionManager.current.sendTo(peerId, {
                type: 'room_info',
                senderId: localId.current,
                senderName: localName.current,
                payload: { room: prev.room, authorized: true }
              });
            } else {
              // Wrong passcode
              connectionManager.current.sendTo(peerId, {
                type: 'room_info',
                senderId: localId.current,
                senderName: localName.current,
                payload: { authorized: false, error: 'Invalid passcode' }
              });
              console.warn('Guest attempted to join with wrong passcode');
            }
          }
          return prev;

        case 'room_info':
          if (message.payload.authorized === false) {
            // Passcode validation failed
            connectionManager.current?.close();
            connectionManager.current = null;
            toast({
              title: "Access Denied",
              description: message.payload.error || "Invalid passcode. Reconnect and try again.",
              variant: "destructive"
            });
            return {
              ...prev,
              connectionStatus: 'disconnected',
              room: null,
              peers: []
            };
          }
          return {
            ...prev,
            room: message.payload.room
          };

        case 'start_request':
          // If a guest requests start, and we're the host, start the game with the provided questions
          if (prev.isHost && connectionManager.current) {
            const questions = message.payload?.questions || prev.sharedQuestions || [];
            // call startGame (will run because we're host)
            // startGame is defined later but captured from closure; invoke via setTimeout to ensure it's available
            setTimeout(() => {
              // @ts-ignore - startGame exists in closure
              (startGame as any)(questions);
            }, 0);
          }
          return prev;

        case 'lobby_request':
          // Guest requested to return to lobby; if we're host, set room.status back to 'waiting'
          if (prev.isHost && connectionManager.current && prev.room) {
            const updatedRoom = { ...prev.room, status: 'waiting' as const };
            connectionManager.current.broadcast({
              type: 'room_update',
              senderId: localId.current,
              senderName: localName.current,
              payload: { room: updatedRoom }
            });
            return { ...prev, room: updatedRoom, gameState: null };
          }
          return prev;

        case 'lobby_update':
          // Host has updated lobby status or settings
          return {
            ...prev,
            room: message.payload.room
          };

        default:
          return prev;
      }
    });
  }, []);

  // Send a chat message
  const sendChatMessage = useCallback((text: string) => {
    if (!connectionManager.current) return;

    const message: Omit<GameMessage, 'timestamp'> = {
      type: 'chat',
      senderId: localId.current,
      senderName: localName.current,
      payload: { text }
    };

    connectionManager.current.broadcast(message);
    
    // Add to local messages
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, { ...message, timestamp: Date.now() }]
    }));
  }, []);

  // Send a cooperative clue (uses chat payload with kind='clue')
  const sendClue = useCallback((text: string) => {
    if (!connectionManager.current) return;

    const message: Omit<GameMessage, 'timestamp'> = {
      type: 'chat',
      senderId: localId.current,
      senderName: localName.current,
      payload: { text, kind: 'clue' }
    };

    connectionManager.current.broadcast(message);

    // Also append locally
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, { ...message, timestamp: Date.now() }]
    }));
  }, []);

  // Start the game (host only)
  const startGame = useCallback((questions: any[]) => {
    if (!state.isHost || !connectionManager.current) return;

    const initialGameState: MultiplayerGameState = {
      currentQuestionIndex: 0,
      currentQuestion: questions[0],
      scores: state.room?.currentPlayers.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}) || {},
      answers: {},
      phase: 'question',
      timer: 30
    };

    // First update room status and inform peers so clients switch view
    const updatedRoom = state.room ? { ...state.room, status: 'playing' as const } : null;

    if (updatedRoom) {
      connectionManager.current.broadcast({
        type: 'room_update',
        senderId: localId.current,
        senderName: localName.current,
        payload: { room: updatedRoom }
      });
    }

    // Update host state
    setState(prev => ({
      ...prev,
      room: updatedRoom,
      gameState: initialGameState,
      sharedQuestions: questions
    }));

    // Then broadcast the game start payload
    connectionManager.current.broadcast({
      type: 'game_start',
      senderId: localId.current,
      senderName: localName.current,
      payload: { gameState: initialGameState, questions }
    });
  }, [state.isHost, state.room]);

  // Request start of the game (guests will send a request to host; host will start directly)
  const requestStartGame = useCallback((questions: any[]) => {
    if (state.isHost) {
      startGame(questions);
      return;
    }

    if (!connectionManager.current) return;

    connectionManager.current.broadcast({
      type: 'start_request',
      senderId: localId.current,
      senderName: localName.current,
      payload: { questions }
    });
  }, [state.isHost, startGame]);

  // Submit an answer
  const submitAnswer = useCallback((answer: string) => {
    if (!connectionManager.current) return;

    connectionManager.current.broadcast({
      type: 'answer',
      senderId: localId.current,
      senderName: localName.current,
      payload: { answer, submittedAt: Date.now() }
    });

    setState(prev => ({
      ...prev,
      gameState: prev.gameState ? {
        ...prev.gameState,
        answers: {
          ...prev.gameState.answers,
          [localId.current]: answer
        }
      } : null
    }));
  }, []);

  // Update scores (host only)
  const updateScores = useCallback((scores: Record<string, number>, phase?: string, roundWinner?: string) => {
    if (!state.isHost || !connectionManager.current) return;

    connectionManager.current.broadcast({
      type: 'score_update',
      senderId: localId.current,
      senderName: localName.current,
      payload: { scores, phase, roundWinner }
    });

    setState(prev => ({
      ...prev,
      gameState: prev.gameState ? {
        ...prev.gameState,
        scores,
        phase: (phase as any) || prev.gameState.phase,
        roundWinner
      } : null
    }));
  }, [state.isHost]);

  // Send next question (host only)
  const sendQuestion = useCallback((question: any, index: number, timer: number = 30) => {
    if (!state.isHost || !connectionManager.current) return;

    connectionManager.current.broadcast({
      type: 'question',
      senderId: localId.current,
      senderName: localName.current,
      payload: { question, index, timer }
    });

    setState(prev => ({
      ...prev,
      gameState: prev.gameState ? {
        ...prev.gameState,
        currentQuestion: question,
        currentQuestionIndex: index,
        phase: 'question',
        timer,
        answers: {}
      } : null
    }));
  }, [state.isHost]);

  // Leave the room
  const leaveRoom = useCallback(() => {
    connectionManager.current?.close();
    connectionManager.current = null;
    setState({
      isHost: false,
      room: null,
      peers: [],
      messages: [],
      connectionStatus: 'disconnected',
      gameState: null,
      sharedQuestions: []
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionManager.current?.close();
    };
  }, []);

  // Listen for UI-driven lobby request events (from MultiplayerGame button)
  useEffect(() => {
    const handler = () => {
      if (!connectionManager.current) return;
      if (state.isHost && state.room) {
        // Host can just set room back to waiting
        const updatedRoom = { ...state.room, status: 'waiting' as const };
        connectionManager.current.broadcast({
          type: 'room_update',
          senderId: localId.current,
          senderName: localName.current,
          payload: { room: updatedRoom }
        });
        setState(prev => ({ ...prev, room: updatedRoom, gameState: null }));
      } else {
        // Guest requests host to switch back to lobby
        connectionManager.current.broadcast({
          type: 'lobby_request',
          senderId: localId.current,
          senderName: localName.current,
          payload: {}
        });
      }
    };

    window.addEventListener('multiplayer-lobby-request', handler as EventListener);
    return () => window.removeEventListener('multiplayer-lobby-request', handler as EventListener);
  }, [state.isHost, state.room]);

  return {
    ...state,
    localId: localId.current,
    localName: localName.current,
    createRoom,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    sendClue,
    startGame,
    requestStartGame,
    submitAnswer,
    updateScores,
    sendQuestion,
    updateRoomSettings,
    isWebRTCSupported: isWebRTCAvailable(),
    isBluetoothSupported: isBluetoothAvailable()
  };
};
