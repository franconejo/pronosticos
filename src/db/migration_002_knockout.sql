ALTER TABLE matches ADD COLUMN is_knockout INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN penalty_winner TEXT CHECK (penalty_winner IN ('home', 'away'));
ALTER TABLE predictions ADD COLUMN penalty_winner TEXT CHECK (penalty_winner IN ('home', 'away'));
