/**
 * Conflict resolution strategies for offline-first sync
 */

export type ConflictResolution = 'server-wins' | 'local-wins' | 'merged' | 'user-choice';

export interface ConflictItem {
  id: string;
  table: string;
  localVersion: any;
  serverVersion: any;
  localUpdatedAt: number;
  serverUpdatedAt: number;
}

export interface ConflictResolutionResult {
  id: string;
  strategy: ConflictResolution;
  resolvedData: any;
  requiresUserAction: boolean;
  reason: string;
}

const ignoredConflictKeys = new Set(['updated_at', 'updatedAt', 'created_at', 'createdAt']);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const normalizeForCompare = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForCompare(entry));
  }

  if (isPlainObject(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (ignoredConflictKeys.has(key)) continue;
      normalized[key] = normalizeForCompare(value[key]);
    }
    return normalized;
  }

  return value;
};

const stableSerialize = (value: unknown): string => {
  return JSON.stringify(normalizeForCompare(value));
};

const areDeepEqual = (left: unknown, right: unknown): boolean => {
  return stableSerialize(left) === stableSerialize(right);
};

const mergeArrays = (local: unknown[], server: unknown[]): unknown[] => {
  const deduped = new Map<string, unknown>();
  for (const item of [...server, ...local]) {
    deduped.set(stableSerialize(item), item);
  }
  return [...deduped.values()];
};

const mergeValues = (
  local: unknown,
  server: unknown,
  path: string,
  conflicts: string[]
): unknown => {
  if (areDeepEqual(local, server)) return server;

  if (Array.isArray(local) && Array.isArray(server)) {
    return mergeArrays(local, server);
  }

  if (isPlainObject(local) && isPlainObject(server)) {
    const merged: Record<string, unknown> = { ...server };
    const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in local)) {
        merged[key] = server[key];
        continue;
      }
      if (!(key in server)) {
        merged[key] = local[key];
        continue;
      }
      merged[key] = mergeValues(local[key], server[key], childPath, conflicts);
    }
    return merged;
  }

  conflicts.push(`Field '${path || 'root'}' differs`);
  return server;
};

/**
 * Attempt intelligent merge of local and server versions
 * Works best for additive changes (new fields, list additions)
 */
export const intelligentMerge = (
  local: any,
  server: any
): { merged: any; conflicts: string[] } => {
  if (!isPlainObject(local) || !isPlainObject(server)) {
    return { merged: server, conflicts: [] };
  }

  const conflicts: string[] = [];
  const merged = mergeValues(local, server, '', conflicts);
  return { merged, conflicts };
};

/**
 * Resolve a conflict using specified strategy
 */
export const resolveConflict = (
  conflict: ConflictItem,
  strategy: ConflictResolution = 'merged'
): ConflictResolutionResult => {
  const { id, localVersion, serverVersion, localUpdatedAt, serverUpdatedAt } = conflict;

  switch (strategy) {
    case 'server-wins':
      return {
        id,
        strategy: 'server-wins',
        resolvedData: serverVersion,
        requiresUserAction: false,
        reason: 'Server version kept (strategy: server-wins)'
      };

    case 'local-wins':
      return {
        id,
        strategy: 'local-wins',
        resolvedData: localVersion,
        requiresUserAction: false,
        reason: 'Local version kept (strategy: local-wins)'
      };

    case 'merged': {
      const { merged, conflicts } = intelligentMerge(localVersion, serverVersion);
      const preferredSource = serverUpdatedAt >= localUpdatedAt ? 'server' : 'local';
      return {
        id,
        strategy: 'merged',
        resolvedData: merged,
        requiresUserAction: conflicts.length > 0,
        reason: conflicts.length > 0
          ? `Merged with ${conflicts.length} conflict(s), defaulted to ${preferredSource} values on conflicting primitives`
          : 'Successfully merged without conflicts'
      };
    }

    case 'user-choice':
    default:
      return {
        id,
        strategy: 'user-choice',
        resolvedData: null,
        requiresUserAction: true,
        reason: `Conflict requires user decision. Server: ${stableSerialize(serverVersion)}, Local: ${stableSerialize(localVersion)}`
      };
  }
};

/**
 * Batch resolve multiple conflicts
 */
export const resolveBatchConflicts = (
  conflicts: ConflictItem[],
  strategy: ConflictResolution = 'merged'
): ConflictResolutionResult[] => {
  return conflicts.map((conflict) => resolveConflict(conflict, strategy));
};

/**
 * Detect if a conflict would occur
 */
export const detectConflict = (
  localVersion: any,
  serverVersion: any,
  lastSyncedVersion: any
): boolean => {
  if (areDeepEqual(localVersion, serverVersion)) {
    return false;
  }

  const localChanged = !areDeepEqual(localVersion, lastSyncedVersion);
  const serverChanged = !areDeepEqual(serverVersion, lastSyncedVersion);
  return localChanged && serverChanged;
};
