PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nick TEXT NOT NULL UNIQUE COLLATE NOCASE,
  real_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  bank_name TEXT NOT NULL DEFAULT '',
  bank_alias TEXT NOT NULL DEFAULT '',
  pin_hash TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  is_temp INTEGER NOT NULL DEFAULT 0,
  merged_into TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff_at TEXT NOT NULL,              -- ISO UTC
  closes_at TEXT NOT NULL,               -- ISO UTC, límite de pronóstico
  base_prize INTEGER NOT NULL CHECK (base_prize > 0),
  home_score INTEGER CHECK (home_score >= 0),
  away_score INTEGER CHECK (away_score >= 0),
  is_knockout INTEGER NOT NULL DEFAULT 0,
  penalty_winner TEXT CHECK (penalty_winner IN ('home', 'away')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'finished')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL CHECK (home_score >= 0),
  away_score INTEGER NOT NULL CHECK (away_score >= 0),
  penalty_winner TEXT CHECK (penalty_winner IN ('home', 'away')),
  points INTEGER,
  prize INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);

CREATE TABLE IF NOT EXISTS monthly_configs (
  month TEXT PRIMARY KEY,                -- YYYY-MM
  first_prize INTEGER NOT NULL DEFAULT 80000,
  second_prize INTEGER NOT NULL DEFAULT 50000,
  third_prize INTEGER NOT NULL DEFAULT 30000,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'suggested', 'approved', 'paid'))
);

CREATE TABLE IF NOT EXISTS monthly_payouts (
  month TEXT NOT NULL REFERENCES monthly_configs(month) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  exact_hits INTEGER NOT NULL DEFAULT 0,
  winner_hits INTEGER NOT NULL DEFAULT 0,
  rank_group INTEGER,
  suggested_prize INTEGER NOT NULL DEFAULT 0,
  final_prize INTEGER NOT NULL DEFAULT 0,
  admin_override INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (month, user_id)
);
