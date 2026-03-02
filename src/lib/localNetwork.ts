/**
 * Local Network P2P Service
 * Provides WebRTC-based peer-to-peer connectivity for local multiplayer
 * Uses Supabase Realtime for signaling to enable true cross-device connectivity
 */

import { supabase } from '@/integrations/supabase/client';

export type ConnectionMethod = 'wifi' | 'bluetooth';
export type PeerRole = 'host' | 'guest';
export type GameMode = 'competitive' | 'cooperative';

export interface LocalPeer {
  id: string;
  name: string;
  connectionMethod: ConnectionMethod;
  isHost: boolean;
  score?: number;
  ready?: boolean;
}

export interface GameRoom {
  id: string;
  passcode: string;
  hostId: string;
  hostName: string;
  gameName: string;
  gameType: 'trivia' | 'guess_character' | 'fill_blank' | 'memory_verse' | 'daily_challenge' | 'all';
  gameMode: GameMode;
  maxPlayers: number;
  currentPlayers: LocalPeer[];
  status: 'waiting' | 'playing' | 'finished';
  // Number of questions per game/round (optional)
  questionsPerRound?: number;
  createdAt: number;
}

export interface GameMessage {
  type: 'chat' | 'game_state' | 'answer' | 'score_update' | 'player_join' | 'player_leave' | 'game_start' | 'question' | 'room_update' | 'request_room_info' | 'room_info' | 'start_request' | 'lobby_request' | 'lobby_update';
  senderId: string;
  senderName: string;
  payload: any;
  timestamp: number;
}

// Generate a short room code
export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate a 4-digit passcode for security
export const generatePasscode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Validate passcode format
export const isValidPasscode = (passcode: string): boolean => {
  return /^\d{4}$/.test(passcode);
};

// WebRTC configuration for local network (STUN servers for NAT traversal)
export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Signaling using Supabase Realtime for cross-device connectivity
export class RealtimeSignaling {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private handlers: Map<string, (data: any) => void> = new Map();
  private roomId: string;
  private localId: string;
  private isSubscribed: boolean = false;
  private pendingMessages: Array<{ type: string; data: any; from: string }> = [];
  private subscribePromise: Promise<void>;
  private resolveSubscribe!: () => void;
  private subscribeTimeoutId: number | null = null;
  private retryCount = 0;
  private closed = false;

  constructor(roomId: string, localId: string) {
    this.roomId = roomId;
    this.localId = localId;
    this.subscribePromise = this.createSubscribePromise();
    this.setupChannel();
  }

  private createSubscribePromise() {
    return new Promise<void>((resolve) => {
      this.resolveSubscribe = resolve;
    });
  }

  private resetSubscriptionState() {
    this.isSubscribed = false;
    this.subscribePromise = this.createSubscribePromise();
    if (this.subscribeTimeoutId) {
      window.clearTimeout(this.subscribeTimeoutId);
      this.subscribeTimeoutId = null;
    }
  }

  private teardownChannel() {
    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch (err) {
        console.warn('Failed to remove signaling channel safely:', err);
      }
      this.channel = null;
    }
  }

  private setupChannel() {
    if (this.closed) return;

    // (Re)create subscribe promise each time we set up a channel.
    this.resetSubscriptionState();

    try {
      this.channel = supabase.channel(`game-room-${this.roomId}`, {
        config: {
          broadcast: { self: false }
        }
      });

      this.channel
        .on('broadcast', { event: 'signaling' }, ({ payload }) => {
          try {
            const { type, data, from } = payload;
            // Ignore messages from self
            if (from === this.localId) return;
            
            const handler = this.handlers.get(type);
            if (handler) {
              handler({ ...data, from });
            }
          } catch (e) {
            console.error('Error handling signaling payload:', e);
          }
        })
        .subscribe((status) => {
          try {
            console.log('Signaling channel status:', status, 'for room:', this.roomId);

            if (status === 'SUBSCRIBED') {
              this.retryCount = 0;
              this.isSubscribed = true;
              console.log('✓ Successfully subscribed to signaling channel for room:', this.roomId);
              this.resolveSubscribe();
              // Send any pending messages
              this.pendingMessages.forEach((msg) => {
                this.send(msg.type, msg.data, msg.from);
              });
              this.pendingMessages = [];
              return;
            }

            // If realtime fails to subscribe, try recreating the channel.
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              console.warn('Signaling channel error, will retry:', status);
              this.retrySubscribe();
            }
          } catch (e) {
            console.error('Error in subscribe handler:', e);
            this.retrySubscribe();
          }
        });
    } catch (err) {
      console.error('Failed to setup signaling channel:', err);
      // Schedule a retry
      this.retrySubscribe();
    }

    // Safety timeout: some environments never emit TIMED_OUT.
    // Increase timeout to allow slower networks to subscribe
    this.subscribeTimeoutId = window.setTimeout(() => {
      if (!this.isSubscribed) {
        console.warn('Signaling subscribe timeout - retrying');
        this.retrySubscribe();
      }
    }, 15000);
  }

  private retrySubscribe() {
    if (this.closed) return;
    // Allow more retry attempts before giving up
    if (this.retryCount >= 6) {
      console.error('Exceeded signaling retry attempts, giving up for now');
      return;
    }
    this.retryCount += 1;

    const delay = Math.min(500 * Math.pow(2, this.retryCount - 1), 8000);
    console.warn(`Retrying signaling subscription (attempt ${this.retryCount}) in ${delay}ms`);

    this.teardownChannel();
    window.setTimeout(() => {
      this.setupChannel();
    }, delay);
  }

  async waitForSubscription(timeoutMs: number = 7000): Promise<void> {
    // Resolve when subscribed; if it takes too long, trigger retry and continue.
    await Promise.race([
      this.subscribePromise,
      new Promise<void>((resolve) => {
        window.setTimeout(() => {
          if (!this.isSubscribed) this.retrySubscribe();
          resolve();
        }, timeoutMs);
      })
    ]);
  }

  send(type: string, data: any, from: string) {
    if (this.channel) {
      if (!this.isSubscribed) {
        // Queue message if not yet subscribed
        this.pendingMessages.push({ type, data, from });
        console.debug('Queued signaling message (not subscribed):', type, data, 'from', from);
        // Nudge a retry in case we're stuck.
        this.retrySubscribe();
        return;
      }
      this.channel.send({
        type: 'broadcast',
        event: 'signaling',
        payload: { type, data, from }
      });
    }
  }

  on(type: string, handler: (data: any) => void) {
    this.handlers.set(type, handler);
  }

  off(type: string) {
    this.handlers.delete(type);
  }

  close() {
    this.closed = true;
    this.teardownChannel();
    this.isSubscribed = false;
    this.pendingMessages = [];
    if (this.subscribeTimeoutId) {
      window.clearTimeout(this.subscribeTimeoutId);
      this.subscribeTimeoutId = null;
    }
  }
}

// WebRTC Peer Connection Manager
export class PeerConnectionManager {
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private signaling: RealtimeSignaling;
  private roomId: string;
  private localId: string;
  private localName: string;
  private onMessageCallback?: (peerId: string, message: GameMessage) => void;
  private onPeerConnectedCallback?: (peer: LocalPeer) => void;
  private onPeerDisconnectedCallback?: (peerId: string) => void;
  private pendingConnections: Set<string> = new Set();

  constructor(roomId: string, localId: string, localName: string) {
    this.roomId = roomId;
    this.localId = localId;
    this.localName = localName;
    this.signaling = new RealtimeSignaling(roomId, localId);
    this.setupSignalingHandlers();
  }

  private setupSignalingHandlers() {
    this.signaling.on('offer', async (data) => {
      if (data.to !== this.localId) return;
      console.log('Received offer from:', data.from);
      await this.handleOffer(data.from, data.offer, data.senderName);
    });

    this.signaling.on('answer', async (data) => {
      if (data.to !== this.localId) return;
      console.log('Received answer from:', data.from);
      await this.handleAnswer(data.from, data.answer);
    });

    this.signaling.on('ice-candidate', async (data) => {
      if (data.to !== this.localId) return;
      await this.handleIceCandidate(data.from, data.candidate);
    });

    this.signaling.on('peer-announce', (data) => {
      if (data.from !== this.localId && !this.connections.has(data.from) && !this.pendingConnections.has(data.from)) {
        console.log('Peer announced:', data.from, data.senderName);
        // Respond to let them know we're here
        // Do NOT initiate connection - let the announcer initiate after getting this response
        this.signaling.send('peer-response', { 
          to: data.from,
          senderName: this.localName 
        }, this.localId);
      }
    });

    this.signaling.on('peer-response', (data) => {
      if (data.to === this.localId && !this.connections.has(data.from) && !this.pendingConnections.has(data.from)) {
        console.log('Peer responded:', data.from, data.senderName);
        // Response to our announcement - initiate connection
        console.log('Guest received response from host, initiating connection');
        this.connectToPeer(data.from, data.senderName);
      }
    });
  }

  // Announce presence in the room
  async announce() {
    // Wait for signaling channel to be subscribed first
    console.log('Starting announcement, waiting for subscription...');
    await this.signaling.waitForSubscription();
    
    console.log('Announcing presence in room:', this.roomId);
    
    // Send initial announcement
    this.signaling.send('peer-announce', { senderName: this.localName }, this.localId);
    
    // Continue announcing periodically to ensure discovery, even after connecting
    // This allows late joiners to discover the room
    const announceInterval = setInterval(() => {
      this.signaling.send('peer-announce', { senderName: this.localName }, this.localId);
    }, 3000);

    // Keep announcing indefinitely (until close is called)
    // Store interval ID so it can be cleared on close
    (this as any).announceIntervalId = announceInterval;
  }

  // Respond to announcements (for hosts)
  respondToAnnouncement(toId: string) {
    this.signaling.send('peer-response', { 
      to: toId,
      senderName: this.localName 
    }, this.localId);
  }

  // Create connection to a peer
  async connectToPeer(peerId: string, peerName: string) {
    if (this.connections.has(peerId) || this.pendingConnections.has(peerId)) return;

    console.log('Connecting to peer:', peerId);
    this.pendingConnections.add(peerId);

    const pc = new RTCPeerConnection(rtcConfig);
    this.connections.set(peerId, pc);

    // Create data channel
    const channel = pc.createDataChannel('game', { ordered: true });
    this.setupDataChannel(channel, peerId, peerName);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', peerId);
        this.signaling.send('ice-candidate', {
          to: peerId,
          candidate: event.candidate
        }, this.localId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state changed to:', pc.connectionState, 'with peer:', peerId);
      if (pc.connectionState === 'failed') {
        console.error('❌ Connection FAILED with peer:', peerId, '- will retry on next announcement');
        // Don't immediately close - other peers might still connect
        // The connection will be retried if the peer announces again
      } else if (pc.connectionState === 'disconnected') {
        console.warn('⚠ Connection DISCONNECTED with peer:', peerId);
        this.dataChannels.delete(peerId);
        this.onPeerDisconnectedCallback?.(peerId);
      } else if (pc.connectionState === 'closed') {
        console.warn('Connection CLOSED with peer:', peerId);
        this.dataChannels.delete(peerId);
        this.pendingConnections.delete(peerId);
        this.connections.delete(peerId);
        this.onPeerDisconnectedCallback?.(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState, 'with peer:', peerId);
    };

    // Create and send offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('Sending offer to peer:', peerId);
      this.signaling.send('offer', {
        to: peerId,
        offer: offer,
        senderName: this.localName
      }, this.localId);
    } catch (error) {
      console.error('Error creating offer:', error);
      this.pendingConnections.delete(peerId);
      this.connections.delete(peerId);
    }
  }

  private async handleOffer(fromId: string, offer: RTCSessionDescriptionInit, senderName: string) {
    if (this.connections.has(fromId)) {
      const existing = this.connections.get(fromId);
      // If existing connection is closed/failed/disconnected, clean up and accept the new offer
      const shouldReplace = existing && (
        (existing.connectionState === 'closed') ||
        (existing.connectionState === 'failed') ||
        (existing.iceConnectionState === 'failed') ||
        (existing.iceConnectionState === 'disconnected')
      );

      if (shouldReplace) {
        console.warn('Replacing stale/failed connection with peer:', fromId);
        try {
          existing?.close();
        } catch (e) {
          /* ignore */
        }
        this.dataChannels.delete(fromId);
        this.pendingConnections.delete(fromId);
        this.connections.delete(fromId);
      } else {
        // Active connection exists; ignore duplicate offer
        console.log('Already have active connection with peer:', fromId, 'ignoring offer');
        return;
      }
    }

    console.log('Received offer from peer:', fromId, '(' + senderName + ')');
    this.pendingConnections.add(fromId);
    const pc = new RTCPeerConnection(rtcConfig);
    this.connections.set(fromId, pc);

    pc.ondatachannel = (event) => {
      console.log('Received data channel from peer:', fromId);
      this.setupDataChannel(event.channel, fromId, senderName);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate (answer) to:', fromId);
        this.signaling.send('ice-candidate', {
          to: fromId,
          candidate: event.candidate
        }, this.localId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state changed to:', pc.connectionState, 'with peer:', fromId);
      if (pc.connectionState === 'failed') {
        console.error('❌ Connection FAILED with peer:', fromId, '- waiting for retry');
      } else if (pc.connectionState === 'disconnected') {
        console.warn('⚠ Connection DISCONNECTED with peer:', fromId);
        this.dataChannels.delete(fromId);
        this.onPeerDisconnectedCallback?.(fromId);
      } else if (pc.connectionState === 'closed') {
        console.warn('Connection CLOSED with peer:', fromId);
        this.dataChannels.delete(fromId);
        this.pendingConnections.delete(fromId);
        this.connections.delete(fromId);
        this.onPeerDisconnectedCallback?.(fromId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState, 'with peer:', fromId);
    };

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('Sending answer back to peer:', fromId);
      this.signaling.send('answer', {
        to: fromId,
        answer: answer
      }, this.localId);
    } catch (error) {
      console.error('Error handling offer:', error);
      this.pendingConnections.delete(fromId);
      this.connections.delete(fromId);
    }
  }

  private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.connections.get(fromId);
    if (pc && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(answer);
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    }
  }

  private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const pc = this.connections.get(fromId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string, peerName: string) {
    channel.onopen = () => {
      console.log('✓ Data channel OPENED with peer:', peerId, '(' + peerName + ')');
      this.dataChannels.set(peerId, channel);
      this.pendingConnections.delete(peerId);
      this.onPeerConnectedCallback?.({
        id: peerId,
        name: peerName,
        connectionMethod: 'wifi',
        isHost: false
      });
    };

    channel.onclose = () => {
      console.log('× Data channel CLOSED with peer:', peerId);
      this.dataChannels.delete(peerId);
      // Notify listeners that peer disconnected
      this.onPeerDisconnectedCallback?.(peerId);
      // Keep pending connection state in case of transient close
      // Only remove from pending if it was actually failed
    };

    channel.onerror = (error) => {
      console.error('Data channel ERROR with peer:', peerId, error);
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as GameMessage;
        this.onMessageCallback?.(peerId, message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }

  // Send message to all connected peers
  broadcast(message: Omit<GameMessage, 'timestamp'>) {
    const fullMessage: GameMessage = {
      ...message,
      timestamp: Date.now()
    };
    const data = JSON.stringify(fullMessage);
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(data);
      }
    });
  }

  // Send message to specific peer
  sendTo(peerId: string, message: Omit<GameMessage, 'timestamp'>) {
    const channel = this.dataChannels.get(peerId);
    if (channel?.readyState === 'open') {
      const fullMessage: GameMessage = {
        ...message,
        timestamp: Date.now()
      };
      channel.send(JSON.stringify(fullMessage));
    }
  }

  // Event handlers
  onMessage(callback: (peerId: string, message: GameMessage) => void) {
    this.onMessageCallback = callback;
  }

  onPeerConnected(callback: (peer: LocalPeer) => void) {
    this.onPeerConnectedCallback = callback;
  }

  onPeerDisconnected(callback: (peerId: string) => void) {
    this.onPeerDisconnectedCallback = callback;
  }

  // Get connected peer count
  getConnectedPeerCount(): number {
    return this.dataChannels.size;
  }

  // Cleanup
  close() {
    // Clear announce interval if it exists
    if ((this as any).announceIntervalId) {
      clearInterval((this as any).announceIntervalId);
    }
    
    this.dataChannels.forEach((channel) => channel.close());
    this.connections.forEach((pc) => pc.close());
    this.signaling.close();
    this.connections.clear();
    this.dataChannels.clear();
    this.pendingConnections.clear();
  }
}

// Check if Bluetooth is available
export const isBluetoothAvailable = (): boolean => {
  return 'bluetooth' in navigator;
};

// Check if WebRTC is available
export const isWebRTCAvailable = (): boolean => {
  return 'RTCPeerConnection' in window;
};
