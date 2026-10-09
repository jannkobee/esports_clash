import type { CoachCard, PlayerCard } from './types';
import type { DraftSide, DraftSnapshot } from './draftRules';

export interface OnlineSession { 
  code: string; 
  token: string; 
  side: DraftSide; 
  matchType?: 'ranked' | 'normal';
}

export interface OnlineRoom extends DraftSnapshot { 
  ready: boolean;
  matchType?: 'ranked' | 'normal';
  blueRating?: number;
  redRating?: number;
}

async function request<T>(path: string, method = 'GET', token?: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/rooms${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  }).catch(() => { throw new Error('Online rooms are unavailable right now.'); });
  const value = await response.json().catch(() => { throw new Error('Online rooms are unavailable right now.'); });
  if (!response.ok) throw new Error(value.error || 'Room server is unavailable.');
  return value as T;
}

export async function createOnlineRoom(
  roster: PlayerCard[], 
  coach: CoachCard, 
  matchType: 'ranked' | 'normal' = 'ranked',
  rating: number = 300
) {
  return request<{ token: string; side: DraftSide; room: OnlineRoom }>('', 'POST', undefined, { roster, coach, matchType, rating });
}

export async function joinOnlineRoom(
  code: string, 
  roster: PlayerCard[], 
  coach: CoachCard,
  rating: number = 300
) {
  return request<{ token: string; side: DraftSide; room: OnlineRoom }>(`/${code.toUpperCase()}/join`, 'POST', undefined, { roster, coach, rating });
}

export async function getOnlineRoom(session: OnlineSession) {
  return request<OnlineRoom>(`/${session.code}`, 'GET', session.token);
}

export async function submitOnlineDraft(session: OnlineSession, championId: string, slot: number, revision: number) {
  return request<OnlineRoom>(`/${session.code}/draft`, 'POST', session.token, { championId, slot, revision });
}
