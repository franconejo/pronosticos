import { writeFileSync } from 'fs';

const users = [
  { id: '6fbd2bc1-b7ac-4d19-b550-35b3fa1ec908', nick: 'FranConejo' },
  { id: 'b1f95c6e-9c40-49db-8909-ebef8f906392', nick: 'Saldaña' },
  { id: 'a59f7d14-b4b7-4621-bc26-1162713207df', nick: 'Furia' },
  { id: '44f98f89-d628-432c-aa61-f72efec1d2a8', nick: 'Gualber' },
  { id: '39e643a5-9957-41dd-b008-be4b0c6dc144', nick: 'Ever' },
  { id: 'dcfb1aae-7ef9-4d6a-8081-38be9431f3c6', nick: 'Lucita' },
  { id: 'c05255cd-6105-4c76-b623-1c15e15fd0d1', nick: 'Jorge RD' },
  { id: '71ac3b0c-d9d3-40d6-933c-aec7d9d5065f', nick: 'Schembori' },
  { id: 'd2043b06-b268-44a7-9cfb-4b23706dfafb', nick: 'Director' },
  { id: 'ad683a0b-0fbe-4fd9-b30f-23a462b99f8b', nick: 'Recalde' },
  { id: '74b0cfaa-e33b-4190-9e4e-8e4a74f9840c', nick: 'Shaolin' },
  { id: 'd5bef357-d41c-4943-83cc-056218e3f41f', nick: 'Dr. Zarza' },
  { id: 'd578e69f-eb84-4acf-ba7d-03698b20b000', nick: 'Chancho' },
  { id: '7483383e-fc3f-4641-a439-f7cee6eb6530', nick: 'Zaratito' },
  { id: '15f3fc75-43d6-4d1b-826e-8e4c167c0537', nick: 'CM Butti' },
  { id: 'f3088500-337c-43ad-845c-c8f1246994ad', nick: 'La Franchi' },
  { id: '719b7573-21fc-49f6-9a24-096b56ff80d1', nick: 'Gale' },
  { id: '1529358a-ae33-442d-bc1b-fcd683737ab7', nick: 'Vic' },
  { id: 'f3a0ab2a-4b30-49ba-8248-fcb49c3a4ae0', nick: 'Pinazzo' },
  { id: '20ca68cc-33db-45b1-9a20-50b23d40591d', nick: 'Raul M.' },
];

const matches = [
  { id: 'sim-oct-01', real: [2,1] },
  { id: 'sim-oct-02', real: [1,1] },
  { id: 'sim-oct-03', real: [0,2] },
  { id: 'sim-oct-04', real: [3,0] },
];

// predictions per nick: array of [h,a] for 4 matches
const picks = {
  'FranConejo':  [[2,1],[1,1],[0,2],[3,0]], // 6,6,6,6 = 24
  'Saldaña':     [[2,1],[1,1],[0,2],[2,0]], // 6,6,6,3 = 21
  'Furia':       [[2,1],[1,1],[0,2],[0,1]], // 6,6,6,1 = 19
  'Gualber':     [[1,0],[1,1],[0,2],[2,0]], // 3,6,6,3 = 18
  'Ever':        [[2,1],[0,0],[0,2],[2,1]], // 6,3,6,3 = 18
  'Lucita':      [[2,1],[1,1],[1-1?0:0,1],[1,0]], // fix below
};
// easier to define clearly
const P = {
  'FranConejo':  [[2,1],[1,1],[0,2],[3,0]],
  'Saldaña':     [[2,1],[1,1],[0,2],[2,0]],
  'Furia':       [[2,1],[1,1],[0,2],[0,1]],
  'Gualber':     [[1,0],[1,1],[0,2],[2,0]], // 3,6,6,3=18
  'Ever':        [[2,1],[0,0],[0,2],[2,1]], // 6,3,6,3=18
  'Lucita':      [[2,1],[2,2],[0,2],[1,0]], // 6,3,6,3=18
  'Jorge RD':    [[2,1],[1,1],[0,1],[1,0]], // 6,6,3,3=18
  'Schembori':   [[1,0],[1,1],[0,1],[3,0]], // 3,6,3,6=18
  'Director':    [[2,0],[1,1],[0,2],[1,0]], // 3,6,6,3=18
  'Recalde':     [[2,1],[0,0],[0,1],[2,0]], // 6,3,3,3=15
  'Shaolin':     [[1,0],[1,1],[1,2],[1,0]], // 3,6,3,3=15
  'Dr. Zarza':   [[2,1],[2,2],[1,0],[2,0]], // 6,3,1,3=13
  'Chancho':     [[1,0],[0,0],[0,1],[1,0]], // 3,3,3,3=12
  'Zaratito':    [[2,1],[1,0],[0,1],[0,1]], // 6,1,3,1=11
  'CM Butti':    [[1,0],[2,1],[0,2],[0,0]], // 3,1,6,1=11
  'La Franchi':  [[0,0],[1,1],[1,1],[1,0]], // 3,6,1,3=13? wait compute
  'Gale':        [[1,2],[0,0],[0,1],[2,0]], // 1,3,3,3=10
  'Vic':         [[0,1],[2,0],[0,2],[0,2]], // 1,1,6,1=9
  'Pinazzo':     [[1,0],[2,1],[1,0],[1,1]], // 3,1,1,1=6
  'Raul M.':     [[0,2],[1,2],[1,0],[0,1]], // 1,1,1,1=4
};

function outcome(h,a){return h>a?'H':h<a?'A':'D';}
function pts(ph,pa,rh,ra){ if(ph===rh&&pa===ra) return 6; if(outcome(ph,pa)===outcome(rh,ra)) return 3; return 1; }

let sql = `PRAGMA foreign_keys = ON;\n\n`;
sql += `INSERT OR REPLACE INTO monthly_configs (month, first_prize, second_prize, third_prize, status)\nVALUES ('2026-10', 80000, 50000, 30000, 'draft');\n\n`;
sql += `INSERT OR REPLACE INTO matches (id, home_team, away_team, kickoff_at, closes_at, base_prize, home_score, away_score, is_knockout, penalty_winner, status, created_at) VALUES\n`;
sql += `('sim-oct-01', 'Cerro Porteño', 'Guaraní',        '2026-10-04T20:30:00Z', '2026-10-04T20:00:00Z', 30000, 2, 1, 0, NULL, 'finished', '2026-10-01T12:00:00Z'),\n`;
sql += `('sim-oct-02', 'Olimpia',      'Libertad',       '2026-10-11T20:30:00Z', '2026-10-11T20:00:00Z', 30000, 1, 1, 0, NULL, 'finished', '2026-10-08T12:00:00Z'),\n`;
sql += `('sim-oct-03', '2 de Mayo',    'Sportivo Luqueño','2026-10-18T20:30:00Z', '2026-10-18T20:00:00Z', 30000, 0, 2, 0, NULL, 'finished', '2026-10-15T12:00:00Z'),\n`;
sql += `('sim-oct-04', 'Nacional',     'Tacuary',        '2026-10-25T20:30:00Z', '2026-10-25T20:00:00Z', 30000, 3, 0, 0, NULL, 'finished', '2026-10-22T12:00:00Z');\n\n`;

const rows = [];
for (const u of users) {
  const preds = P[u.nick];
  preds.forEach((p, i) => {
    const m = matches[i];
    const points = pts(p[0],p[1],m.real[0],m.real[1]);
    rows.push({ u: u.id, m: m.id, h: p[0], a: p[1], points });
  });
}

// compute prizes per match
for (const m of matches) {
  const mrows = rows.filter(r => r.m === m.id);
  const exact = mrows.filter(r => r.points === 6);
  const base = 30000;
  for (const r of mrows) {
    r.prize = r.points === 6 ? (exact.length === 1 ? base*2 : base) : 0;
  }
}

sql += `INSERT OR REPLACE INTO predictions (match_id, user_id, home_score, away_score, penalty_winner, points, prize, edit_count, created_at, updated_at) VALUES\n`;
sql += rows.map((r, idx) => `('${r.m}', '${r.u}', ${r.h}, ${r.a}, NULL, ${r.points}, ${r.prize}, 0, '2026-10-01T12:${String(idx).padStart(2,'0')}:00Z', '2026-10-01T12:${String(idx).padStart(2,'0')}:00Z')`).join(',\n');
sql += ';\n';

writeFileSync('src/db/sim_oct_2026_prod.sql', sql);
console.log('ok', rows.length);
