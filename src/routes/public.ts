import { Hono } from 'hono';
import { html } from 'hono/html';
import type { Bindings, Variables, Match, Prediction, User } from '../types';
import { layout } from '../views/layout';
import { createId, createSession, clearSession, hashPin, verifyPin } from '../lib/auth';
import { nowIso, formatDateTime, monthKey } from '../lib/time';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function flash(c: any) {
  const ok = c.req.query('ok');
  const err = c.req.query('err');
  if (ok) return { type: 'ok' as const, message: ok };
  if (err) return { type: 'err' as const, message: err };
  return null;
}

app.get('/', async (c) => {
  const user = c.get('user');
  const matches = await c.env.DB.prepare(
    `SELECT * FROM matches ORDER BY 
      CASE status WHEN 'open' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END, kickoff_at DESC LIMIT 50`,
  ).all<Match>();

  let myPreds: Record<string, Prediction> = {};
  if (user) {
    const rows = await c.env.DB.prepare('SELECT * FROM predictions WHERE user_id = ?')
      .bind(user.id)
      .all<Prediction>();
    myPreds = Object.fromEntries((rows.results || []).map((p) => [p.match_id, p]));
  }

  const now = nowIso();
  const body = html`
    <div class="card">
      <h1>Partidos</h1>
      <p class="muted">Cargá tu pronóstico antes del cierre. Solo el nick se muestra públicamente.</p>
      ${!user ? html`<p><a href="/login">Entrá</a> o <a href="/registro">registrate</a> para jugar.</p>` : ''}
    </div>
    <div class="grid">
      ${(matches.results || []).map((m) => {
        const p = myPreds[m.id];
        const open = m.status === 'open' && m.closes_at > now;
        return html`
          <div class="card">
            <div class="row" style="justify-content:space-between; align-items:center;">
              <h3 style="margin:0">${m.home_team} vs ${m.away_team}</h3>
              <span class="badge">${m.status === 'finished' ? 'Finalizado' : open ? 'Abierto' : 'Cerrado'}</span>
            </div>
            <p class="small">Inicio: ${formatDateTime(m.kickoff_at)} · Cierra: ${formatDateTime(m.closes_at)} · Premio base: ${m.base_prize.toLocaleString('es-PY')} Gs</p>
            ${m.status === 'finished' ? html`<p><strong>Resultado:</strong> ${m.home_score} - ${m.away_score}</p>` : ''}
            ${p ? html`<p><strong>Tu pronóstico:</strong> ${p.home_score} - ${p.away_score} ${p.points != null ? html`· <span class="ok">${p.points} pts</span> · Premio: ${p.prize.toLocaleString('es-PY')} Gs` : ''}</p>` : ''}
            <p><a href="/partidos/${m.id}">${open ? 'Cargar / ver pronóstico' : 'Ver detalle'}</a></p>
          </div>`;
      })}
      ${!(matches.results || []).length ? html`<div class="card"><p class="muted">Todavía no hay partidos.</p></div>` : ''}
    </div>`;

  return c.html(layout({ title: 'Partidos', user, body: String(body), flash: flash(c) }));
});

app.get('/login', (c) => {
  const user = c.get('user');
  if (user) return c.redirect('/');
  const body = html`
    <div class="card" style="max-width:520px">
      <h1>Entrar</h1>
      <form method="post" action="/login" class="grid">
        <label>Teléfono <input name="phone" required /></label>
        <label>PIN <input name="pin" type="password" required /></label>
        <button type="submit">Entrar</button>
      </form>
      <p class="small">¿No tenés cuenta? <a href="/registro">Registrate</a>.</p>
    </div>`;
  return c.html(layout({ title: 'Entrar', user: null, body: String(body), flash: flash(c) }));
});

app.post('/login', async (c) => {
  const form = await c.req.parseBody();
  const phone = String(form.phone || '').trim();
  const pin = String(form.pin || '');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE phone = ? AND active = 1')
    .bind(phone)
    .first<User>();
  if (!user || !(await verifyPin(pin, user.pin_hash))) {
    return c.redirect('/login?err=' + encodeURIComponent('Teléfono o PIN incorrecto'));
  }
  await createSession(c, user.id);
  return c.redirect('/?ok=' + encodeURIComponent('Bienvenido, ' + user.nick));
});

app.get('/registro', (c) => {
  if (c.get('user')) return c.redirect('/');
  const body = html`
    <div class="card" style="max-width:640px">
      <h1>Registro</h1>
      <p class="small">Solo tu nick se mostrará públicamente. Los demás datos son privados para el admin/pagos.</p>
      <form method="post" action="/registro" class="grid">
        <label>Nick público <input name="nick" required maxlength="30" /></label>
        <label>Nombre real <input name="real_name" required maxlength="80" /></label>
        <label>Teléfono <input name="phone" required maxlength="30" /></label>
        <label>Banco <input name="bank_name" maxlength="60" /></label>
        <label>Alias/cuenta bancaria <input name="bank_alias" maxlength="60" /></label>
        <label>PIN (4+ caracteres) <input name="pin" type="password" required minlength="4" /></label>
        <button type="submit">Crear cuenta</button>
      </form>
    </div>`;
  return c.html(layout({ title: 'Registro', user: null, body: String(body), flash: flash(c) }));
});

app.post('/registro', async (c) => {
  const form = await c.req.parseBody();
  const nick = String(form.nick || '').trim();
  const realName = String(form.real_name || '').trim();
  const phone = String(form.phone || '').trim();
  const bankName = String(form.bank_name || '').trim();
  const bankAlias = String(form.bank_alias || '').trim();
  const pin = String(form.pin || '');

  if (!nick || !realName || !phone || pin.length < 4) {
    return c.redirect('/registro?err=' + encodeURIComponent('Completá los campos obligatorios'));
  }

  const byPhone = await c.env.DB.prepare(
    'SELECT id, nick, is_temp, merged_into FROM users WHERE phone = ?',
  ).bind(phone).first<any>();
  const byNick = await c.env.DB.prepare(
    'SELECT id, phone FROM users WHERE nick = ? COLLATE NOCASE',
  ).bind(nick).first<any>();

  if (byPhone && byPhone.is_temp === 1 && !byPhone.merged_into) {
    if (byNick && byNick.id !== byPhone.id) {
      return c.redirect('/registro?err=' + encodeURIComponent('Ese nick ya está en uso. Elegí otro.'));
    }
    const body = html`
      <div class="card" style="max-width:680px">
        <h1>¿Sos ${byPhone.nick}?</h1>
        <p>Encontramos un usuario temporal con este número de teléfono: <strong>${byPhone.nick}</strong>.</p>
        <p class="small">Si sos vos, reclamá la cuenta para conservar el historial y los pronósticos cargados por el admin.</p>
        <div class="grid grid-2">
          <div class="card">
            <h3>Sí, soy yo</h3>
            <form method="post" action="/registro/reclamar" class="grid">
              <input type="hidden" name="temp_user_id" value="${byPhone.id}" />
              <input type="hidden" name="nick" value="${nick}" />
              <input type="hidden" name="real_name" value="${realName}" />
              <input type="hidden" name="phone" value="${phone}" />
              <input type="hidden" name="bank_name" value="${bankName}" />
              <input type="hidden" name="bank_alias" value="${bankAlias}" />
              <input type="hidden" name="pin" value="${pin}" />
              <button type="submit">Reclamar cuenta</button>
            </form>
          </div>
          <div class="card">
            <h3>No, no soy yo</h3>
            <p class="small">No se puede crear otra cuenta con el mismo número. Podés registrarte con otro número y pedirle al admin que fusione las cuentas, o pedirle al admin que corrija el número del usuario temporal.</p>
            <p><a href="/registro">Volver al registro</a></p>
          </div>
        </div>
      </div>`;
    return c.html(layout({ title: 'Reclamar cuenta', user: null, body: String(body), flash: null }));
  }

  if (byPhone) return c.redirect('/registro?err=' + encodeURIComponent('Ese teléfono ya está registrado'));
  if (byNick) return c.redirect('/registro?err=' + encodeURIComponent('Ese nick ya está en uso'));

  const count = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  const role = (count?.c || 0) === 0 ? 'admin' : 'player';
  const id = createId();
  const pinHash = await hashPin(pin);

  await c.env.DB.prepare(
    `INSERT INTO users (id,nick,real_name,phone,bank_name,bank_alias,pin_hash,role,active,is_temp,created_at)
     VALUES (?,?,?,?,?,?,?,?,1,0,?)`,
  )
    .bind(id, nick, realName, phone, bankName, bankAlias, pinHash, role, nowIso())
    .run();

  await createSession(c, id);
  return c.redirect('/?ok=' + encodeURIComponent('Cuenta creada'));
});

app.post('/registro/reclamar', async (c) => {
  const form = await c.req.parseBody();
  const tempUserId = String(form.temp_user_id || '').trim();
  const nick = String(form.nick || '').trim();
  const realName = String(form.real_name || '').trim();
  const phone = String(form.phone || '').trim();
  const bankName = String(form.bank_name || '').trim();
  const bankAlias = String(form.bank_alias || '').trim();
  const pin = String(form.pin || '');

  if (!tempUserId || !nick || !realName || !phone || pin.length < 4) {
    return c.redirect('/registro?err=' + encodeURIComponent('Datos incompletos para reclamar cuenta'));
  }

  const temp = await c.env.DB.prepare(
    'SELECT id, phone, is_temp, merged_into FROM users WHERE id = ?',
  ).bind(tempUserId).first<any>();
  if (!temp || temp.is_temp !== 1 || temp.merged_into || temp.phone !== phone) {
    return c.redirect('/registro?err=' + encodeURIComponent('No se pudo reclamar la cuenta temporal'));
  }

  const nickUsed = await c.env.DB.prepare(
    'SELECT id FROM users WHERE nick = ? COLLATE NOCASE AND id != ?',
  ).bind(nick, tempUserId).first<any>();
  if (nickUsed) return c.redirect('/registro?err=' + encodeURIComponent('Ese nick ya está en uso. Elegí otro.'));

  const pinHash = await hashPin(pin);
  await c.env.DB.prepare(
    `UPDATE users SET nick=?, real_name=?, phone=?, bank_name=?, bank_alias=?, pin_hash=?, is_temp=0, active=1 WHERE id=?`,
  ).bind(nick, realName, phone, bankName, bankAlias, pinHash, tempUserId).run();

  await createSession(c, tempUserId);
  return c.redirect('/?ok=' + encodeURIComponent('Cuenta reclamada correctamente'));
});

app.post('/logout', async (c) => {
  await clearSession(c);
  return c.redirect('/login?ok=' + encodeURIComponent('Sesión cerrada'));
});

app.get('/tabla', async (c) => {
  const month = c.req.query('mes') || monthKey(nowIso());
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO monthly_configs (month) VALUES (?)`,
  ).bind(month).run();
  const config = await c.env.DB.prepare('SELECT * FROM monthly_configs WHERE month = ?').bind(month).first<any>();

  const rows = await c.env.DB.prepare(
    `SELECT u.nick,
            COALESCE(SUM(p.points),0) as points,
            COALESCE(SUM(CASE WHEN p.points = 6 THEN 1 ELSE 0 END),0) as exact_hits,
            COALESCE(SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END),0) as winner_hits,
            COALESCE(mp.final_prize, 0) as final_prize,
            COALESCE(mp.suggested_prize, 0) as suggested_prize,
            COALESCE(mp.admin_override, 0) as admin_override
     FROM users u
     LEFT JOIN predictions p ON p.user_id = u.id
     LEFT JOIN matches m ON m.id = p.match_id AND m.status = 'finished' AND substr(m.kickoff_at,1,7) = ?
     LEFT JOIN monthly_payouts mp ON mp.user_id = u.id AND mp.month = ?
     WHERE u.active = 1
     GROUP BY u.id
     HAVING COUNT(p.match_id) > 0 OR COALESCE(mp.final_prize,0) > 0
     ORDER BY points DESC, exact_hits DESC, winner_hits DESC, u.nick ASC`,
  ).bind(month, month).all<any>();

  const body = html`
    <div class="card">
      <h1>Tabla mensual</h1>
      <form method="get" action="/tabla" class="row">
        <label>Mes <input type="month" name="mes" value="${month}" /></label>
        <button type="submit">Ver</button>
      </form>
      <p class="small">Bolsas: 1° ${Number(config?.first_prize||80000).toLocaleString('es-PY')} · 2° ${Number(config?.second_prize||50000).toLocaleString('es-PY')} · 3° ${Number(config?.third_prize||30000).toLocaleString('es-PY')} Gs. Estado: ${config?.status || 'draft'}.</p>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>#</th><th>Nick</th><th>Puntos</th><th>Exactos</th><th>Ganador</th><th>Premio final</th></tr></thead>
        <tbody>
          ${(rows.results || []).map((r: any, i: number) => html`
            <tr>
              <td>${i + 1}</td>
              <td>${r.nick}</td>
              <td><strong>${r.points}</strong></td>
              <td>${r.exact_hits}</td>
              <td>${r.winner_hits}</td>
              <td>${Number(r.final_prize || 0).toLocaleString('es-PY')} Gs ${r.admin_override ? html`<span class="badge">manual</span>` : ''}</td>
            </tr>`)}
          ${!(rows.results || []).length ? html`<tr><td colspan="6" class="muted">Sin datos para este mes.</td></tr>` : ''}
        </tbody>
      </table>
    </div>`;
  return c.html(layout({ title: 'Tabla mensual', user: c.get('user'), body: String(body), flash: flash(c) }));
});

export default app;
