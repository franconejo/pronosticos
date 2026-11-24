import type { D1Database } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;
  APP_NAME?: string;
  SESSION_SECRET?: string;
};

export type Role = 'player' | 'admin';

export interface User {
  id: string;
  nick: string;
  real_name: string;
  phone: string;
  bank_name: string;
  bank_alias: string;
  pin_hash: string;
  google_sub: string | null;
  role: Role;
  active: number;
  is_temp: number;
  merged_into: string | null;
  created_at: string;
}

export interface PublicUser {
  id: string;
  nick: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export type MatchStatus = 'open' | 'closed' | 'finished';
export type PenaltyWinner = 'home' | 'away' | null;

export interface Match {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  closes_at: string;
  base_prize: number;
  home_score: number | null;
  away_score: number | null;
  is_knockout: number;
  penalty_winner: 'home' | 'away' | null;
  status: MatchStatus;
  created_at: string;
}

export interface Prediction {
  match_id: string;
  user_id: string;
  home_score: number;
  away_score: number;
  penalty_winner: 'home' | 'away' | null;
  points: number | null;
  prize: number;
  edit_count: number;
  created_at: string;
  updated_at: string;
}

export type Variables = {
  user: User | null;
};
