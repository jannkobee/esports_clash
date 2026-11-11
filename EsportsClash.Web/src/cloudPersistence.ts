import type { MatchReport } from './matchReplay';
import type { PlayerCard } from './types';

export interface ApiSession {
  token: string;
  user: { id: number; name: string; email: string; is_evolution_admin?:boolean; supporter?:import('./supporter').SupporterMembership; theme?:import('./supporter').PersonalTheme };
}

export interface ClubSnapshot {
  schema_version: number;
  roster: PlayerCard[];
  starting_five: string[];
  updated_at?: string;
}

const API_SESSION_KEY = 'esports-clash-api-session-v1';
export const API_SESSION_CHANGED = 'esports-clash-account-changed';
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const backendPageUrl=(path:string)=>apiBaseUrl.replace(/\/api\/v1$/, '')+path;

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
  window.dispatchEvent(new Event(API_SESSION_CHANGED));
}

const publicReads=new Map<string,{expires:number;data:unknown}>();
if(typeof window!=='undefined')window.addEventListener('hexatrick-world-updated',()=>publicReads.clear());
export async function request<T>(path: string, session: ApiSession | null, init: RequestInit = {}): Promise<T> {
  if (!isCloudPersistenceConfigured()) throw new Error('Cloud persistence is not configured.');
  const cacheable=!session&&(!init.method||init.method==='GET')&&/^\/(avatarpedia|world\/(news|broadcasts)|competitions)(?:[/?]|$)/.test(path);
  const cached=cacheable?publicReads.get(path):null;if(cached&&cached.expires>Date.now())return structuredClone(cached.data) as T;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,cache:'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401 && session && loadApiSession()?.token === session.token) persistApiSession(null);
    const problem = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(problem?.message ?? `API request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  const data=await response.json() as T;if(cacheable){if(publicReads.size>120)publicReads.clear();publicReads.set(path,{expires:Date.now()+5000,data:structuredClone(data)});}return data;
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

export const publicApiAsset=(path:string)=>path.startsWith('/club-media/')?apiBaseUrl+path:'';
