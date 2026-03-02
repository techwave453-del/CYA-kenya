/**
 * Offline chat message caching and queueing
 * Allows reading cached conversations and queuing messages when offline
 */

import { getAll, put, remove, clearStore, getById } from './offlineDb';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface CachedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  userId?: string;
}

export interface QueuedMessage {
  id: string;
  conversationId: string;
  message: ChatMessage;
  timestamp: number;
  retryCount?: number;
  syncedAt?: number;
}

const CHAT_CACHE_STORE = 'bible_chat_cache';
const MESSAGE_QUEUE_STORE = 'bible_message_queue';

const makeId = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Cache a conversation locally
 */
export const cacheConversation = async (conversation: CachedConversation): Promise<void> => {
  try {
    const data = {
      ...conversation,
      updatedAt: Date.now()
    };
    await put(CHAT_CACHE_STORE, data as any);
    console.log(`[offlineChat] Cached conversation ${conversation.id}`);
  } catch (error) {
    console.error('[offlineChat] Error caching conversation:', error);
  }
};

/**
 * Get cached conversation
 */
export const getCachedConversation = async (id: string): Promise<CachedConversation | undefined> => {
  try {
    const conv = await getById<CachedConversation>(CHAT_CACHE_STORE, id);
    console.log(`[offlineChat] Retrieved cached conversation ${id}`);
    return conv;
  } catch (error) {
    console.error('[offlineChat] Error retrieving conversation:', error);
    return undefined;
  }
};

/**
 * Get all cached conversations
 */
export const getAllCachedConversations = async (): Promise<CachedConversation[]> => {
  try {
    const conversations = await getAll<CachedConversation>(CHAT_CACHE_STORE);
    console.log(`[offlineChat] Retrieved ${conversations.length} cached conversations`);
    return conversations;
  } catch (error) {
    console.error('[offlineChat] Error retrieving conversations:', error);
    return [];
  }
};

/**
 * Add message to cached conversation
 */
export const addMessageToConversation = async (
  conversationId: string,
  message: ChatMessage
): Promise<void> => {
  try {
    const conv = await getCachedConversation(conversationId);
    if (!conv) {
      console.warn(`[offlineChat] Conversation ${conversationId} not found`);
      return;
    }

    const updatedConv = {
      ...conv,
      messages: [...(conv.messages || []), { ...message, timestamp: message.timestamp || Date.now() }],
      updatedAt: Date.now()
    };

    await cacheConversation(updatedConv);
    console.log(`[offlineChat] Added message to conversation ${conversationId}`);
  } catch (error) {
    console.error('[offlineChat] Error adding message to conversation:', error);
  }
};

/**
 * Queue a message for sending when online
 */
export const queueMessage = async (
  conversationId: string,
  message: ChatMessage
): Promise<string> => {
  try {
    const queuedMsg: QueuedMessage = {
      id: makeId(),
      conversationId,
      message: { ...message, timestamp: message.timestamp || Date.now() },
      timestamp: Date.now(),
      retryCount: 0
    };

    await put(MESSAGE_QUEUE_STORE, queuedMsg as any);
    console.log(`[offlineChat] Queued message ${queuedMsg.id} for conversation ${conversationId}`);
    return queuedMsg.id;
  } catch (error) {
    console.error('[offlineChat] Error queueing message:', error);
    throw error;
  }
};

/**
 * Get queued messages for a conversation
 */
export const getQueuedMessages = async (conversationId: string): Promise<QueuedMessage[]> => {
  try {
    const allQueued = await getAll<QueuedMessage>(MESSAGE_QUEUE_STORE);
    const filtered = allQueued.filter(msg => msg.conversationId === conversationId);
    console.log(`[offlineChat] Retrieved ${filtered.length} queued messages for ${conversationId}`);
    return filtered;
  } catch (error) {
    console.error('[offlineChat] Error retrieving queued messages:', error);
    return [];
  }
};

/**
 * Get all queued messages
 */
export const getAllQueuedMessages = async (): Promise<QueuedMessage[]> => {
  try {
    const queued = await getAll<QueuedMessage>(MESSAGE_QUEUE_STORE);
    console.log(`[offlineChat] Retrieved ${queued.length} total queued messages`);
    return queued;
  } catch (error) {
    console.error('[offlineChat] Error retrieving all queued messages:', error);
    return [];
  }
};

/**
 * Mark message as synced / remove from queue
 */
export const markMessageSynced = async (messageId: string): Promise<void> => {
  try {
    await remove(MESSAGE_QUEUE_STORE, messageId);
    console.log(`[offlineChat] Marked message ${messageId} as synced`);
  } catch (error) {
    console.error('[offlineChat] Error marking message as synced:', error);
  }
};

/**
 * Increment retry count for a queued message
 */
export const incrementMessageRetry = async (messageId: string): Promise<void> => {
  try {
    const msg = await getById<QueuedMessage>(MESSAGE_QUEUE_STORE, messageId);
    if (msg) {
      const updated = {
        ...msg,
        retryCount: (msg.retryCount || 0) + 1
      };
      await put(MESSAGE_QUEUE_STORE, updated as any);
      console.log(`[offlineChat] Incremented retry count for ${messageId}`);
    }
  } catch (error) {
    console.error('[offlineChat] Error incrementing retry:', error);
  }
};

/**
 * Clear all queued messages (use with caution!)
 */
export const clearMessageQueue = async (): Promise<void> => {
  try {
    await clearStore(MESSAGE_QUEUE_STORE);
    console.log('[offlineChat] Cleared entire message queue');
  } catch (error) {
    console.error('[offlineChat] Error clearing queue:', error);
  }
};

/**
 * Remove cached conversation
 */
export const removeCachedConversation = async (id: string): Promise<void> => {
  try {
    await remove(CHAT_CACHE_STORE, id);
    // Also remove all associated queued messages
    const allQueued = await getAllQueuedMessages();
    for (const msg of allQueued) {
      if (msg.conversationId === id) {
        await markMessageSynced(msg.id);
      }
    }
    console.log(`[offlineChat] Removed cached conversation ${id}`);
  } catch (error) {
    console.error('[offlineChat] Error removing conversation:', error);
  }
};
