import type { MatchReport } from './matchReplay';
import type { PlayerCard } from './types';

export interface ApiSession {
  token: string;
  user: { id: number; name: string; email: string };
}

export interface ClubSnapshot {
  schema_version: number;
  roster: PlayerCard[];
  starting_five: string[];
  updated_at?: string;
}

const API_SESSION_KEY = 'esports-clash-api-session-v1';
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function isCloudPersistenceConfigured(): boolean {
  return apiBaseUrl.length > 0;
}

export function loadApiSession(): ApiSession | null {
  try {
    const stored = JSON.parse(localStorage.getItem(API_SESSION_KEY) ?? 'null') as ApiSession | null;
    return stored?.token && stored.user ? stored : null;
  } catch {
    return null;
  }
}

export function persistApiSession(session: ApiSession | null): void {
  if (session) localStorage.setItem(API_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(API_SESSION_KEY);
}

export async function request<T>(path: string, session: ApiSession | null, init: RequestInit = {}): Promise<T> {
  if (!isCloudPersistenceConfigured()) throw new Error('Cloud persistence is not configured.');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(problem?.message ?? `API request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function registerCloudAccount(input: {
  name: string; email: string; password: string; password_confirmation: string; device_name?: string;
}): Promise<ApiSession> {
  return request<ApiSession>('/auth/register', null, { method: 'POST', body: JSON.stringify(input) });
}

export async function loginCloudAccount(input: { email: string; password: string; device_name?: string }): Promise<ApiSession> {
  return request<ApiSession>('/auth/login', null, { method: 'POST', body: JSON.stringify(input) });
}

export async function logoutCloudAccount(session: ApiSession): Promise<void> {
  await request<void>('/auth/token', session, { method: 'DELETE' });
  persistApiSession(null);
}

export async function loadCloudClub(session: ApiSession): Promise<ClubSnapshot | null> {
  const response = await request<{ data: ClubSnapshot | null }>('/club', session);
  return response.data;
}

export async function saveCloudClub(session: ApiSession, roster: PlayerCard[], startingFive: PlayerCard[]): Promise<ClubSnapshot> {
  const response = await request<{ data: ClubSnapshot }>('/club', session, {
    method: 'PUT',
    body: JSON.stringify({ schema_version: 1, roster, starting_five: startingFive.map(card => card.id) }),
  });
  return response.data;
}

export async function saveCloudMatchReport(session: ApiSession, report: MatchReport): Promise<{ id: number; created_at: string }> {
  const response = await request<{ data: { id: number; created_at: string } }>('/matches', session, {
    method: 'POST', body: JSON.stringify({ report }),
  });
  return response.data;
}
