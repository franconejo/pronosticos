import { Hono } from 'hono';
import { html } from 'hono/html';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import type { Bindings, Variables, Match } from '../types';
import { layout } from '../views/layout';
import { requireAdmin, hashPin, createId } from '../lib/auth';
import { nowIso, formatDateTime, monthKey } from '../lib/time';
import { calcPoints } from '../lib/scoring';
import { calcMatchPrizes, suggestMonthlyPayouts } from '../lib/prizes';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') return c.redirect('/login?err=' + encodeURIComponent('Acceso de admin requerido'));
  await next();
});

function flash(c: any) {
  const ok = c.req.query('ok');
  const err = c.req.query('err');
  if (ok) return { type: 'ok' as const, message: ok };
  if (err) return { type: 'err' as const, message: err };
  return null;
}

app.get('/', async (c) => {
  const matches = await c.env.DB.prepare('SELECT * FROM matches ORDER BY kickoff_at DESC LIMIT 50').all<Match>();
  const users = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  const body = html`
    <div class="card">
      <h1>Panel admin</h1>
      <p class="small">Usuarios: ${users?.c || 0} · <a href="/admin/usuarios">Gestionar usuarios</a> · <a href="/admin/mes">Premios mensuales</a></p>
    </div>

    <div class="card">
      <h2>Crear partido</h2>
      <form method="post" action="/admin/partidos" class="grid grid-2">
        <label>Local <input name="home_team" required /></label>
        <label>Visitante <input name="away_team" required /></label>
        <label>Inicio (ISO o local) <input name="kickoff_at" type="datetime-local" required /></label>
        <label>Cierre pronósticos <input name="closes_at" type="datetime-local" required /></label>
        <label>Premio base (Gs)
          <select name="base_prize">
            <option value="25000">25.000</option>
            <option value="30000">30.000</option>
            <option value="50000">50.000</option>
            <option value="100000">100.000</option>
          </select>
        </label>
        <div style="display:flex;align-items:end"><button type="submit">Crear partido</button></div>
      </form>
      <p class="small">El premio por único ganador exacto se duplica automáticamente.</p>
    </div>

    <div class="card">
      <h2>Partidos</h2>
      <table>
        <thead><tr><th>Partido</th><th>Inicio</th><th>Cierre</th><th>Base</th><th>Estado</th><th>Resultado</th><th>Acciones</th></tr></thead>
        <tbody>
          ${(matches.results || []).map((m) => html`
            <tr>
              <td><a href="/partidos/${m.id}">${m.home_team} vs ${m.away_team}</a></td>
              <td>${formatDateTime(m.kickoff_at)}</td>
              <td>${formatDateTime(m.closes_at)}</td>
              <td>${m.base_prize.toLocaleString('es-PY')}</td>
              <td>${m.status}</td>
              <td>${m.status === 'finished' ? `${m.home_score}-${m.away_score}` : '-'}</td>
              <td>
                ${m.status !== 'finished' ? html`
                  <form class="inline" method="post" action="/admin/partidos/${m.id}/cerrar">
                    <button class="secondary" type="submit">Cerrar</button>
                  </form>
                ` : ''}
              </td>
            </tr>
            ${m.status !== 'finished' ? html`
            <tr>
              <td colspan="7">
                <form method="post" action="/admin/partidos/${m.id}/resultado" class="row">
                  <label>Goles ${m.home_team} <input type="number" name="home_score" min="0" max="99" required /></label>
                  <label>Goles ${m.away_team} <input type="number" name="away_score" min="0" max="99" required /></label>
                  <button type="submit">Cargar resultado y calcular</button>
                </form>
              </td>
            </tr>` : ''}
          `)}
          ${!(matches.results || []).length ? html`<tr><td colspan="7" class="muted">Sin partidos.</td></tr>` : ''}
        </tbody>
      </table>
    </div>`;
  return c.html(layout({ title: 'Admin', user: c.get('user'), body: String(body), flash: flash(c) }));
});

app.post('/partidos', async (c) => {
  const form = await c.req.parseBody();
  const homeTeam = String(form.home_team || '').trim();
  const awayTeam = String(form.away_team || '').trim();
  const kickoffAt = new Date(String(form.kickoff_at)).toISOString();
  const closesAt = new Date(String(form.closes_at)).toISOString();
  const basePrize = Number(form.base_prize || 25000);

  if (!homeTeam || !awayTeam || !kickoffAt || !closesAt) {
    return c.redirect('/admin?err=' + encodeURIComponent('Datos incompletos'));
  }
  if (new Date(closesAt) > new Date(kickoffAt)) {
    return c.redirect('/admin?err=' + encodeURIComponent('El cierre debe ser antes o igual al inicio'));
  }

  await c.env.DB.prepare(
    `INSERT INTO matches (id,home_team,away_team,kickoff_at,closes_at,base_prize,status,created_at)
     VALUES (?,?,?,?,?,?, 'open', ?)`,
  ).bind(createId(), homeTeam, awayTeam, kickoffAt, closesAt, basePrize, nowIso()).run();

  return c.redirect('/admin?ok=' + encodeURIComponent('Partido creado'));
});

app.post('/partidos/:id/cerrar', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`UPDATE matches SET status='closed' WHERE id=? AND status='open'`).bind(id).run();
  return c.redirect('/admin?ok=' + encodeURIComponent('Partido cerrado'));
});

app.post('/partidos/:id/resultado', async (c) => {
  const id = c.req.param('id');
  const match = await c.env.DB.prepare('SELECT * FROM matches WHERE id=?').bind(id).first<Match>();
  if (!match) return c.redirect('/admin?err=' + encodeURIComponent('Partido no encontrado'));
  if (match.status === 'finished') return c.redirect('/admin?err=' + encodeURIComponent('El partido ya fue finalizado'));

  const form = await c.req.parseBody();
  const homeScore = Number(form.home_score);
  const awayScore = Number(form.away_score);
  if (![homeScore, awayScore].every((n) => Number.isInteger(n) && n >= 0 && n <= 99)) {
    return c.redirect('/admin?err=' + encodeURIComponent('Marcador inválido'));
  }

  const preds = await c.env.DB.prepare('SELECT match_id, user_id, home_score, away_score FROM predictions WHERE match_id=?')
    .bind(id).all<any>();
  const results = (preds.results || []).map((p: any) => ({
    userId: p.user_id as string,
    points: calcPoints(p.home_score, p.away_score, homeScore, awayScore),
  }));
  const withPrizes = calcMatchPrizes(results, match.base_prize);

  const stmts: D1PreparedStatement[] = [];
  stmts.push(
    c.env.DB.prepare(`UPDATE matches SET home_score=?, away_score=?, status='finished' WHERE id=?`)
      .bind(homeScore, awayScore, id),
  );
  for (const r of withPrizes) {
    stmts.push(
      c.env.DB.prepare(`UPDATE predictions SET points=?, prize=? WHERE match_id=? AND user_id=?`)
        .bind(r.points, r.prize, id, r.userId),
    );
  }
  if (stmts.length) await c.env.DB.batch(stmts);

  return c.redirect('/admin?ok=' + encodeURIComponent('Resultado cargado y puntos calculados'));
});

app.get('/usuarios', async (c) => {
  const users = await c.env.DB.prepare(
    `SELECT id,nick,real_name,phone,bank_name,bank_alias,role,active,is_temp,merged_into,created_at
     FROM users ORDER BY active DESC, is_temp DESC, created_at DESC`,
  ).all<any>();
  const activeUsers = (users.results || []).filter((u: any) => !u.merged_into);

  const body = html`
    <div class="card">
      <h1>Usuarios</h1>
      <p class="small">Datos privados visibles solo para admin. Los usuarios temporales pueden ser reclamados al registrarse con el mismo teléfono, o fusionados manualmente.</p>
    </div>

    <div class="card">
      <h2>Crear usuario temporal</h2>
      <form method="post" action="/admin/usuarios/temporal" class="grid grid-2">
        <label>Nick <input name="nick" required maxlength="30" /></label>
        <label>Nombre real <input name="real_name" required maxlength="80" /></label>
        <label>Teléfono <input name="phone" required maxlength="30" /></label>
        <label>Banco <input name="bank_name" maxlength="60" /></label>
        <label>Alias/cuenta bancaria <input name="bank_alias" maxlength="60" /></label>
        <div style="display:flex;align-items:end"><button type="submit">Crear temporal</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Fusionar usuarios</h2>
      <p class="small">Usalo cuando exista un usuario temporal y un usuario registrado que deban quedar como uno solo. Las predicciones y pagos mensuales se mueven al usuario destino.</p>
      <form method="post" action="/admin/usuarios/fusionar" class="row">
        <label>Usuario origen (se fusiona y desactiva)
          <select name="source_id" required>
            <option value="">Seleccionar...</option>
            ${activeUsers.map((u: any) => html`<option value="${u.id}">${u.nick} — ${u.phone} ${u.is_temp ? '(temporal)' : ''}</option>`)}
          </select>
        </label>
        <label>Usuario destino (queda activo)
          <select name="target_id" required>
            <option value="">Seleccionar...</option>
            ${activeUsers.map((u: any) => html`<option value="${u.id}">${u.nick} — ${u.phone} ${u.is_temp ? '(temporal)' : ''}</option>`)}
          </select>
        </label>
        <button type="submit">Fusionar</button>
      </form>
    </div>

    <div class="card">
      <h2>Listado</h2>
      <table>
        <thead><tr><th>Nick</th><th>Nombre real</th><th>Teléfono</th><th>Banco</th><th>Alias</th><th>Rol</th><th>Estado</th><th>Nuevo PIN</th><th>Guardar</th></tr></thead>
        <tbody>
          ${(users.results || []).map((u: any) => html`
            <tr>
              <td><input form="f-${u.id}" name="nick" value="${u.nick}" /> ${u.is_temp ? html`<span class="badge">temporal</span>` : ''} ${u.merged_into ? html`<span class="badge">fusionado</span>` : ''}</td>
              <td><input form="f-${u.id}" name="real_name" value="${u.real_name}" /></td>
              <td><input form="f-${u.id}" name="phone" value="${u.phone}" /></td>
              <td><input form="f-${u.id}" name="bank_name" value="${u.bank_name || ''}" /></td>
              <td><input form="f-${u.id}" name="bank_alias" value="${u.bank_alias || ''}" /></td>
              <td>
                <select form="f-${u.id}" name="role">
                  <option value="player" ${u.role==='player'?'selected':''}>player</option>
                  <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
                </select>
              </td>
              <td><select form="f-${u.id}" name="active"><option value="1" ${u.active?'selected':''}>activo</option><option value="0" ${!u.active?'selected':''}>inactivo</option></select></td>
              <td><input form="f-${u.id}" name="new_pin" type="password" minlength="4" placeholder="opcional" /></td>
              <td>
                <form id="f-${u.id}" method="post" action="/admin/usuarios/${u.id}"></form>
                <button form="f-${u.id}" type="submit">Guardar</button>
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>`;
  return c.html(layout({ title: 'Usuarios', user: c.get('user'), body: String(body), flash: flash(c) }));
});

app.post('/usuarios/temporal', async (c) => {
  const form = await c.req.parseBody();
  const nick = String(form.nick || '').trim();
  const realName = String(form.real_name || '').trim();
  const phone = String(form.phone || '').trim();
  const bankName = String(form.bank_name || '').trim();
  const bankAlias = String(form.bank_alias || '').trim();

  if (!nick || !realName || !phone) {
    return c.redirect('/admin/usuarios?err=' + encodeURIComponent('Completá nick, nombre real y teléfono'));
  }

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE nick = ? COLLATE NOCASE OR phone = ?')
    .bind(nick, phone).first<any>();
  if (exists) return c.redirect('/admin/usuarios?err=' + encodeURIComponent('Ya existe un usuario con ese nick o teléfono'));

  const pinHash = await hashPin(createId()); // PIN inutilizable hasta que reclame
  await c.env.DB.prepare(
    `INSERT INTO users (id,nick,real_name,phone,bank_name,bank_alias,pin_hash,role,active,is_temp,created_at)
     VALUES (?,?,?,?,?,?,?,'player',1,1,?)`,
  ).bind(createId(), nick, realName, phone, bankName, bankAlias, pinHash, nowIso()).run();

  return c.redirect('/admin/usuarios?ok=' + encodeURIComponent('Usuario temporal creado'));
});

app.post('/usuarios/fusionar', async (c) => {
  const form = await c.req.parseBody();
  const sourceId = String(form.source_id || '').trim();
  const targetId = String(form.target_id || '').trim();

  if (!sourceId || !targetId) return c.redirect('/admin/usuarios?err=' + encodeURIComponent('Seleccioná origen y destino'));
  if (sourceId === targetId) return c.redirect('/admin/usuarios?err=' + encodeURIComponent('Origen y destino no pueden ser el mismo usuario'));

  const source = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(sourceId).first<any>();
  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(targetId).first<any>();
  if (!source || !target) return c.redirect('/admin/usuarios?err=' + encodeURIComponent('Usuario no encontrado'));
  if (source.merged_into) return c.redirect('/admin/usuarios?err=' + encodeURIComponent('El usuario origen ya fue fusionado'));

  // Mover predicciones: si el destino ya tiene predicción para ese partido, se conserva la del destino.
  const sourcePreds = await c.env.DB.prepare('SELECT * FROM predictions WHERE user_id=?').bind(sourceId).all<any>();
  const targetPreds = await c.env.DB.prepare('SELECT match_id FROM predictions WHERE user_id=?').bind(targetId).all<any>();
  const targetMatchIds = new Set((targetPreds.results || []).map((p: any) => p.match_id));

  const stmts: D1PreparedStatement[] = [];
  for (const p of (sourcePreds.results || [])) {
    if (targetMatchIds.has(p.match_id)) {
      stmts.push(c.env.DB.prepare('DELETE FROM predictions WHERE match_id=? AND user_id=?').bind(p.match_id, sourceId));
    } else {
      stmts.push(c.env.DB.prepare('UPDATE predictions SET user_id=? WHERE match_id=? AND user_id=?').bind(targetId, p.match_id, sourceId));
    }
  }

  // Mover pagos mensuales: si hay conflicto, conservar el del destino.
  const sourcePays = await c.env.DB.prepare('SELECT * FROM monthly_payouts WHERE user_id=?').bind(sourceId).all<any>();
  const targetPays = await c.env.DB.prepare('SELECT month FROM monthly_payouts WHERE user_id=?').bind(targetId).all<any>();
  const targetMonths = new Set((targetPays.results || []).map((p: any) => p.month));
  for (const p of (sourcePays.results || [])) {
    if (targetMonths.has(p.month)) {
      stmts.push(c.env.DB.prepare('DELETE FROM monthly_payouts WHERE month=? AND user_id=?').bind(p.month, sourceId));
    } else {
      stmts.push(c.env.DB.prepare('UPDATE monthly_payouts SET user_id=? WHERE month=? AND user_id=?').bind(targetId, p.month, sourceId));
    }
  }

  stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(sourceId));
  stmts.push(c.env.DB.prepare(
    `UPDATE users SET active=0, is_temp=0, merged_into=?, phone=?, nick=?, pin_hash=? WHERE id=?`,
  ).bind(targetId, `merged:${sourceId}`, `merged:${sourceId.slice(0, 8)}`, await hashPin(createId()), sourceId));

  await c.env.DB.batch(stmts);
  return c.redirect('/admin/usuarios?ok=' + encodeURIComponent(`Usuarios fusionados: ${source.nick} -> ${target.nick}`));
});

app.post('/usuarios/:id', async (c) => {
  const id = c.req.param('id');
  const form = await c.req.parseBody();
  const nick = String(form.nick || '').trim();
  const realName = String(form.real_name || '').trim();
  const phone = String(form.phone || '').trim();
  const bankName = String(form.bank_name || '').trim();
  const bankAlias = String(form.bank_alias || '').trim();
  const role = String(form.role || 'player') === 'admin' ? 'admin' : 'player';
  const active = String(form.active || '1') === '1' ? 1 : 0;
  const newPin = String(form.new_pin || '');

  if (!nick || !realName || !phone) return c.redirect('/admin/usuarios?err=' + encodeURIComponent('Datos inválidos'));

  await c.env.DB.prepare(
    `UPDATE users SET nick=?, real_name=?, phone=?, bank_name=?, bank_alias=?, role=?, active=? WHERE id=?`,
  ).bind(nick, realName, phone, bankName, bankAlias, role, active, id).run();

  if (newPin.length >= 4) {
    const pinHash = await hashPin(newPin);
    await c.env.DB.prepare(`UPDATE users SET pin_hash=? WHERE id=?`).bind(pinHash, id).run();
  }

  return c.redirect('/admin/usuarios?ok=' + encodeURIComponent('Usuario actualizado'));
});

app.get('/mes', async (c) => {
  const month = c.req.query('mes') || monthKey(nowIso());
  await c.env.DB.prepare(`INSERT OR IGNORE INTO monthly_configs (month) VALUES (?)`).bind(month).run();
  const config = await c.env.DB.prepare('SELECT * FROM monthly_configs WHERE month=?').bind(month).first<any>();

  const rows = await c.env.DB.prepare(
    `SELECT u.id as user_id, u.nick,
            COALESCE(SUM(p.points),0) as points,
            COALESCE(SUM(CASE WHEN p.points=6 THEN 1 ELSE 0 END),0) as exact_hits,
            COALESCE(SUM(CASE WHEN p.points=3 THEN 1 ELSE 0 END),0) as winner_hits
     FROM users u
     JOIN predictions p ON p.user_id = u.id
     JOIN matches m ON m.id = p.match_id AND m.status='finished' AND substr(m.kickoff_at,1,7)=?
     WHERE u.active=1
     GROUP BY u.id
     ORDER BY points DESC, exact_hits DESC, winner_hits DESC, u.nick ASC`,
  ).bind(month).all<any>();

  const groupsMap: { points: number; userIds: string[] }[] = [];
  for (const r of (rows.results || [])) {
    const last = groupsMap[groupsMap.length - 1];
    if (last && last.points === r.points) last.userIds.push(r.user_id);
    else groupsMap.push({ points: r.points, userIds: [r.user_id] });
  }
  const slots = [Number(config.first_prize), Number(config.second_prize), Number(config.third_prize)];
  const suggestion = suggestMonthlyPayouts(slots, groupsMap);
  const suggestionByUser = Object.fromEntries(suggestion.payouts.map((p) => [p.userId, p]));

  const body = html`
    <div class="card">
      <h1>Premios mensuales</h1>
      <form method="get" action="/admin/mes" class="row">
        <label>Mes <input type="month" name="mes" value="${month}" /></label>
        <button type="submit">Ver</button>
      </form>
    </div>

    <div class="card">
      <h2>Configuración del mes</h2>
      <form method="post" action="/admin/mes/${month}/config" class="row">
        <label>1° <input type="number" name="first_prize" value="${config.first_prize}" /></label>
        <label>2° <input type="number" name="second_prize" value="${config.second_prize}" /></label>
        <label>3° <input type="number" name="third_prize" value="${config.third_prize}" /></label>
        <button type="submit">Guardar bolsas</button>
      </form>
      <p class="small">Estado: ${config.status}. ${suggestion.needsReview ? html`<span class="err">Hay empates que requieren revisión del admin.</span>` : html`<span class="ok">Sin alertas de revisión.</span>`}</p>
    </div>

    <div class="card">
      <h2>Sugerencia / aprobación</h2>
      <form method="post" action="/admin/mes/${month}/aprobar">
        <table>
          <thead><tr><th>Nick</th><th>Puntos</th><th>Exactos</th><th>Ganador</th><th>Sugerido</th><th>Final (editable)</th><th>Nota</th></tr></thead>
          <tbody>
            ${(rows.results || []).map((r: any) => {
              const s = suggestionByUser[r.user_id];
              return html`
                <tr>
                  <td>${r.nick}<input type="hidden" name="user_id" value="${r.user_id}" /></td>
                  <td>${r.points}<input type="hidden" name="points_${r.user_id}" value="${r.points}" /></td>
                  <td>${r.exact_hits}<input type="hidden" name="exact_${r.user_id}" value="${r.exact_hits}" /></td>
                  <td>${r.winner_hits}<input type="hidden" name="winner_${r.user_id}" value="${r.winner_hits}" /></td>
                  <td>${(s?.suggestedPrize || 0).toLocaleString('es-PY')} ${s?.needsReview ? html`<span class="badge">revisar</span>` : ''}<input type="hidden" name="suggested_${r.user_id}" value="${s?.suggestedPrize || 0}" /></td>
                  <td><input type="number" name="final_${r.user_id}" value="${s?.suggestedPrize || 0}" min="0" /></td>
                  <td><input name="note_${r.user_id}" value="${s?.reason || ''}" /></td>
                </tr>`;
            })}
            ${!(rows.results || []).length ? html`<tr><td colspan="7" class="muted">No hay pronósticos finalizados en este mes.</td></tr>` : ''}
          </tbody>
        </table>
        <p style="margin-top:12px"><button type="submit">Aprobar premios del mes</button></p>
      </form>
    </div>`;

  return c.html(layout({ title: `Premios ${month}`, user: c.get('user'), body: String(body), flash: flash(c) }));
});

app.post('/mes/:month/config', async (c) => {
  const month = c.req.param('month');
  const form = await c.req.parseBody();
  const first = Number(form.first_prize || 80000);
  const second = Number(form.second_prize || 50000);
  const third = Number(form.third_prize || 30000);
  await c.env.DB.prepare(
    `INSERT INTO monthly_configs (month,first_prize,second_prize,third_prize,status)
     VALUES (?,?,?,?, 'draft')
     ON CONFLICT(month) DO UPDATE SET first_prize=excluded.first_prize, second_prize=excluded.second_prize, third_prize=excluded.third_prize`,
  ).bind(month, first, second, third).run();
  return c.redirect(`/admin/mes?mes=${month}&ok=` + encodeURIComponent('Bolsas actualizadas'));
});

app.post('/mes/:month/aprobar', async (c) => {
  const month = c.req.param('month');
  const form = await c.req.parseBody();
  const userIds = form['user_id'];
  const ids = Array.isArray(userIds) ? userIds.map(String) : userIds ? [String(userIds)] : [];

  const stmts: D1PreparedStatement[] = [];
  stmts.push(c.env.DB.prepare(`INSERT OR IGNORE INTO monthly_configs (month) VALUES (?)`).bind(month));
  stmts.push(c.env.DB.prepare(`DELETE FROM monthly_payouts WHERE month=?`).bind(month));

  for (const uid of ids) {
    const points = Number(form[`points_${uid}`] || 0);
    const exact = Number(form[`exact_${uid}`] || 0);
    const winner = Number(form[`winner_${uid}`] || 0);
    const suggested = Number(form[`suggested_${uid}`] || 0);
    const finalPrize = Number(form[`final_${uid}`] || 0);
    const note = String(form[`note_${uid}`] || '');
    const override = finalPrize !== suggested ? 1 : 0;
    stmts.push(c.env.DB.prepare(
      `INSERT INTO monthly_payouts (month,user_id,points,exact_hits,winner_hits,suggested_prize,final_prize,admin_override,note)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).bind(month, uid, points, exact, winner, suggested, finalPrize, override, note));
  }
  stmts.push(c.env.DB.prepare(`UPDATE monthly_configs SET status='approved' WHERE month=?`).bind(month));
  await c.env.DB.batch(stmts);

  return c.redirect(`/admin/mes?mes=${month}&ok=` + encodeURIComponent('Premios mensuales aprobados'));
});

export default app;
