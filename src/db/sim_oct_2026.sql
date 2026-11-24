-- Simulación Octubre 2026 - Primera División Paraguaya
PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO monthly_configs (month, first_prize, second_prize, third_prize, status)
VALUES ('2026-10', 80000, 50000, 30000, 'draft');

-- Partidos
INSERT OR REPLACE INTO matches (id, home_team, away_team, kickoff_at, closes_at, base_prize, home_score, away_score, is_knockout, penalty_winner, status, created_at)
VALUES
('sim-oct-01', 'Cerro Porteño', 'Guaraní',       '2026-10-04T20:30:00Z', '2026-10-04T20:00:00Z', 30000, 2, 1, 0, NULL, 'finished', '2026-10-01T12:00:00Z'),
('sim-oct-02', 'Olimpia',      'Libertad',      '2026-10-11T20:30:00Z', '2026-10-11T20:00:00Z', 30000, 1, 1, 0, NULL, 'finished', '2026-10-08T12:00:00Z'),
('sim-oct-03', '2 de Mayo',    'Sportivo Luqueño','2026-10-18T20:30:00Z', '2026-10-18T20:00:00Z', 30000, 0, 2, 0, NULL, 'finished', '2026-10-15T12:00:00Z'),
('sim-oct-04', 'Nacional',     'Tacuary',       '2026-10-25T20:30:00Z', '2026-10-25T20:00:00Z', 30000, 3, 0, 0, NULL, 'finished', '2026-10-22T12:00:00Z');

-- Pronósticos
-- FranConejo: 24 pts (4 exactos). Match 4 único exacto => premio doble 60000
INSERT OR REPLACE INTO predictions (match_id, user_id, home_score, away_score, penalty_winner, points, prize, edit_count, created_at, updated_at) VALUES
('sim-oct-01', '4a8e11b8-e54f-4551-ae33-99b490b43e41', 2, 1, NULL, 6, 30000, 0, '2026-10-03T12:00:00Z', '2026-10-03T12:00:00Z'),
('sim-oct-02', '4a8e11b8-e54f-4551-ae33-99b490b43e41', 1, 1, NULL, 6, 30000, 0, '2026-10-10T12:00:00Z', '2026-10-10T12:00:00Z'),
('sim-oct-03', '4a8e11b8-e54f-4551-ae33-99b490b43e41', 0, 2, NULL, 6, 30000, 0, '2026-10-17T12:00:00Z', '2026-10-17T12:00:00Z'),
('sim-oct-04', '4a8e11b8-e54f-4551-ae33-99b490b43e41', 3, 0, NULL, 6, 60000, 0, '2026-10-24T12:00:00Z', '2026-10-24T12:00:00Z');

-- Temporal: 21 pts (3 exactos + 1 parcial). Match 4: predijo 2-0, real 3-0 => 3 pts
INSERT OR REPLACE INTO predictions (match_id, user_id, home_score, away_score, penalty_winner, points, prize, edit_count, created_at, updated_at) VALUES
('sim-oct-01', '7ec082fe-338e-48d3-897a-4bc33076e4d6', 2, 1, NULL, 6, 30000, 0, '2026-10-03T12:10:00Z', '2026-10-03T12:10:00Z'),
('sim-oct-02', '7ec082fe-338e-48d3-897a-4bc33076e4d6', 1, 1, NULL, 6, 30000, 0, '2026-10-10T12:10:00Z', '2026-10-10T12:10:00Z'),
('sim-oct-03', '7ec082fe-338e-48d3-897a-4bc33076e4d6', 0, 2, NULL, 6, 30000, 0, '2026-10-17T12:10:00Z', '2026-10-17T12:10:00Z'),
('sim-oct-04', '7ec082fe-338e-48d3-897a-4bc33076e4d6', 2, 0, NULL, 3,     0, 0, '2026-10-24T12:10:00Z', '2026-10-24T12:10:00Z');

-- Prueba: 19 pts (3 exactos + 1 fallo). Match 4: predijo 0-1, real 3-0 => 1 pt
INSERT OR REPLACE INTO predictions (match_id, user_id, home_score, away_score, penalty_winner, points, prize, edit_count, created_at, updated_at) VALUES
('sim-oct-01', 'e206a1e9-43c7-46b3-adde-5aff1ae76f1b', 2, 1, NULL, 6, 30000, 0, '2026-10-03T12:20:00Z', '2026-10-03T12:20:00Z'),
('sim-oct-02', 'e206a1e9-43c7-46b3-adde-5aff1ae76f1b', 1, 1, NULL, 6, 30000, 0, '2026-10-10T12:20:00Z', '2026-10-10T12:20:00Z'),
('sim-oct-03', 'e206a1e9-43c7-46b3-adde-5aff1ae76f1b', 0, 2, NULL, 6, 30000, 0, '2026-10-17T12:20:00Z', '2026-10-17T12:20:00Z'),
('sim-oct-04', 'e206a1e9-43c7-46b3-adde-5aff1ae76f1b', 0, 1, NULL, 1,     0, 0, '2026-10-24T12:20:00Z', '2026-10-24T12:20:00Z');
