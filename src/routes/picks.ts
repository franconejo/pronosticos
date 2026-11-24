import { Hono } from 'hono';
import { html } from 'hono/html';
import type { Bindings, Variables, Match, Prediction } from '../types';
import { layout } from '../views/layout';
import { nowIso, formatDateTime } from '../lib/time';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function flash(c: any) {
  const ok = c.req.query('ok');
  const err = c.req.query('err');
  if (ok) return { type: 'ok' as const, message: ok };
  if (err) return { type: 'err' as const, message: err };
  return null;
}

app.get('/partidos/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const match = await c.env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(id).first<Match>();
  if (!match) return c.notFound();

  const now = nowIso();
  const open = match.status === 'open' && match.closes_at > now;

  let myPred: Prediction | null = null;
  if (user) {
    myPred = await c.env.DB.prepare('SELECT * FROM predictions WHERE match_id = ? AND user_id = ?')
      .bind(id, user.id)
      .first<Prediction>();
  }

  const adminUsers = user?.role === 'admin'
    ? await c.env.DB.prepare(
        `SELECT id, nick, is_temp FROM users WHERE active=1 AND merged_into IS NULL ORDER BY is_temp DESC, nick ASC`,
      ).all<any>()
    : { results: [] as any[] };

  const statsRows = await c.env.DB.prepare('SELECT home_score, away_score FROM predictions WHERE match_id=?')
    .bind(id).all<any>();
  const stats = statsRows.results || [];
  const totalStats = stats.length;
  const localPctCount = stats.filter((p: any) => p.home_score > p.away_score).length;
  const drawPctCount = stats.filter((p: any) => p.home_score === p.away_score).length;
  const awayPctCount = stats.filter((p: any) => p.home_score < p.away_score).length;
  const pct = (n: number) => (totalStats ? Math.round((n * 1000) / totalStats) / 10 : 0);

  const isAdmin = user?.role === 'admin';
  const showAll = isAdmin || match.status !== 'open' || !open;
  const allPreds = showAll
    ? await c.env.DB.prepare(
        `SELECT p.*, u.nick FROM predictions p JOIN users u ON u.id = p.user_id
         WHERE p.match_id = ? ORDER BY u.nick ASC`,
      ).bind(id).all<any>()
    : { results: [] as any[] };

  const formatPick = (p: any) => {
    if (p.home_score === p.away_score) {
      const pen = p.penalty_winner ? ` (${p.penalty_winner === 'home' ? match.home_team : match.away_team})` : '';
      return `Empate ${p.home_score} a ${p.away_score}${pen}`;
    }
    if (p.home_score > p.away_score) return `${match.home_team} ${p.home_score} a ${p.away_score}`;
    return `${match.away_team} ${p.home_score} a ${p.away_score}`;
  };

  const shareText = [
    `*${match.home_team} vs ${match.away_team}*`,
    ...(allPreds.results || []).map((p: any) => `*${p.nick}* ${formatPick(p)}`),
    '',
    '*Pronostica en:* https://pronostico.eibrapp.com.py',
  ].join('\n');

  const body = html`
    <div class="card">
      <h1>${match.home_team} vs ${match.away_team}</h1>
      <div style="margin:8px 0 12px">
        <div style="display:flex;height:18px;border-radius:999px;overflow:hidden;border:1px solid #E5E7EB;background:#F1F5F9">
          <div style="width:${pct(localPctCount)}%;background:#3b82f6" title="${match.home_team}: ${pct(localPctCount)}%"></div>
          <div style="width:${pct(drawPctCount)}%;background:#e5e7eb" title="Empate: ${pct(drawPctCount)}%"></div>
          <div style="width:${pct(awayPctCount)}%;background:#ef4444" title="${match.away_team}: ${pct(awayPctCount)}%"></div>
        </div>
        <div class="small" style="display:flex;justify-content:space-between;gap:8px;margin-top:4px">
          <span style="color:#2563EB">${match.home_team}: ${pct(localPctCount)}%</span>
          <span style="color:#475569">Empate: ${pct(drawPctCount)}%</span>
          <span style="color:#DC2626">${match.away_team}: ${pct(awayPctCount)}%</span>
        </div>
        <div class="small muted">${totalStats} pronóstico${totalStats === 1 ? '' : 's'}</div>
      </div>
      <p class="small">Inicio: ${formatDateTime(match.kickoff_at)} · Cierra: ${formatDateTime(match.closes_at)}</p>
      <p>Premio base: <strong>${match.base_prize.toLocaleString('es-PY')} Gs</strong> · Si hay un solo ganador exacto: <strong>${(match.base_prize * 2).toLocaleString('es-PY')} Gs</strong></p>
      <p>Estado: <span class="badge" style="${match.status === 'finished' ? '' : open ? 'background:#E8F5EC;color:#15803D;border-color:#CDE7D6' : 'background:#FEF3C7;color:#92400E;border-color:#FDE68A'}">${match.status === 'finished' ? 'Finalizado' : open ? 'Abierto' : 'Cerrado'}</span> ${match.is_knockout ? html`<span class="badge">Eliminatoria</span>` : ''} ${open ? html`<span class="ok">Aceptando pronósticos</span>` : html`<span class="muted">Pronósticos cerrados</span>`}</p>
      ${match.status === 'finished' ? html`<p><strong>Resultado final:</strong> <span class="result-highlight">${match.home_score} - ${match.away_score}</span>${match.penalty_winner ? html` <span class="badge">Penales: ${match.penalty_winner === 'home' ? match.home_team : match.away_team}</span>` : ''}</p>` : ''}
    </div>

    <div class="card">
      <h2>Tu pronóstico</h2>
      ${!user ? html`<p>Tenés que <a href="/login">entrar</a> para pronosticar.</p>` : ''}
      ${user && open && (!myPred || (myPred.edit_count ?? 0) < 1) ? html`
        <form method="post" action="/partidos/${match.id}/pronostico" class="row">
          <label>${match.home_team}
            <input type="number" name="home_score" min="0" max="99" required value="${myPred?.home_score ?? ''}" />
          </label>
          <label>${match.away_team}
            <input type="number" name="away_score" min="0" max="99" required value="${myPred?.away_score ?? ''}" />
          </label>
          ${match.is_knockout ? html`
          <label>Si hay empate, gana por penales
            <select name="penalty_winner">
              <option value="" ${!myPred?.penalty_winner ? 'selected' : ''}>Elegir si es empate...</option>
              <option value="home" ${myPred?.penalty_winner === 'home' ? 'selected' : ''}>${match.home_team}</option>
              <option value="away" ${myPred?.penalty_winner === 'away' ? 'selected' : ''}>${match.away_team}</option>
            </select>
          </label>` : ''}
          <button type="submit">${myPred ? 'Actualizar pronóstico' : 'Guardar pronóstico'}</button>
        </form>
        <p class="small">${myPred ? 'Ya cargaste tu pronóstico: te queda 1 cambio antes del cierre.' : 'Podés cargar tu pronóstico una vez y después cambiarlo solo 1 vez antes del cierre.'}</p>
      ` : ''}
      ${user && open && myPred && (myPred.edit_count ?? 0) >= 1 ? html`
        <p>Cargaste: <strong>${myPred.home_score} - ${myPred.away_score}${myPred.penalty_winner ? ` (${myPred.penalty_winner === 'home' ? match.home_team : match.away_team} por penales)` : ''}</strong></p>
        <p class="small">Ya usaste el único cambio permitido para este pronóstico.</p>
      ` : ''}
      ${user && !open ? html`
        <p>${myPred ? html`Cargaste: <strong>${myPred.home_score} - ${myPred.away_score}${myPred.penalty_winner ? ` (${myPred.penalty_winner === 'home' ? match.home_team : match.away_team} por penales)` : ''}</strong>` : 'No cargaste pronóstico para este partido.'}
        ${myPred?.points != null ? html` · Puntos: <strong>${myPred.points}</strong> · Premio: <strong>${myPred.prize.toLocaleString('es-PY')} Gs</strong>` : ''}</p>
      ` : ''}
    </div>

    ${user?.role === 'admin' && match.status !== 'finished' ? html`
    <div class="card">
      <h2>Cargar pronóstico (admin)</h2>
      <p class="small">Usalo para cargar o corregir pronósticos de usuarios temporales o de quienes no pudieron entrar.</p>
      <form method="post" action="/admin/partidos/${match.id}/pronostico" class="row">
        <label>Usuario
          <select name="user_id" required>
            <option value="">Seleccionar...</option>
            ${(adminUsers.results || []).map((u: any) => html`<option value="${u.id}">${u.nick}${u.is_temp ? ' (temporal)' : ''}</option>`)}
          </select>
        </label>
        <label>${match.home_team} <input type="number" name="home_score" min="0" max="99" required /></label>
        <label>${match.away_team} <input type="number" name="away_score" min="0" max="99" required /></label>
        ${match.is_knockout ? html`
        <label>Si hay empate, gana por penales
          <select name="penalty_winner">
            <option value="">Elegir si es empate...</option>
            <option value="home">${match.home_team}</option>
            <option value="away">${match.away_team}</option>
          </select>
        </label>` : ''}
        <button type="submit">Guardar pronóstico</button>
      </form>
    </div>` : ''}

    ${showAll ? html`
    <div class="card">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2 style="margin:0">Pronósticos del partido</h2>
        ${isAdmin ? html`
        <div class="row">
          <button type="button" onclick="(async()=>{const t=document.getElementById('wa-share');try{await navigator.clipboard.writeText(t.value);this.textContent='Copiado';setTimeout(()=>this.textContent='Copiar para WhatsApp',1500);}catch(e){t.style.display='block';t.select();document.execCommand('copy');this.textContent='Copiado';setTimeout(()=>{this.textContent='Copiar para WhatsApp';t.style.display='none';},1500);}}).call(this)">Copiar para WhatsApp</button>
          <a class="badge" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
        </div>` : ''}
      </div>
      ${isAdmin ? html`<textarea id="wa-share" style="display:none;width:100%;height:140px;margin-top:8px">${shareText}</textarea>` : ''}
      <table class="table-stack">
        <thead><tr><th>Nick</th><th>Pronóstico</th><th>Puntos</th><th>Premio</th></tr></thead>
        <tbody>
          ${(allPreds.results || []).map((p: any) => html`
            <tr>
              <td data-label="Nick"><strong>${p.nick}</strong></td>
              <td data-label="Pronóstico">${p.home_score} - ${p.away_score}${p.penalty_winner ? html` <span class="small">(${p.penalty_winner === 'home' ? match.home_team : match.away_team} pen.)</span>` : ''}</td>
              <td data-label="Puntos">${p.points ?? '-'}</td>
              <td data-label="Premio">${Number(p.prize || 0).toLocaleString('es-PY')} Gs</td>
            </tr>`)}
          ${!(allPreds.results || []).length ? html`<tr><td data-label="" colspan="4" class="muted">Sin pronósticos.</td></tr>` : ''}
        </tbody>
      </table>
    </div>` : html`<div class="card"><p class="muted">Los pronósticos de los demás se muestran cuando se cierra el partido.</p></div>`}
  `;

  return c.html(layout({ title: `${match.home_team} vs ${match.away_team}`, user, body: String(body), flash: flash(c) }));
});

app.post('/partidos/:id/pronostico', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/login?err=' + encodeURIComponent('Tenés que entrar'));

  const id = c.req.param('id');
  const match = await c.env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(id).first<Match>();
  if (!match) return c.notFound();

  const now = nowIso();
  if (match.status !== 'open' || match.closes_at <= now) {
    return c.redirect(`/partidos/${id}?err=` + encodeURIComponent('El pronóstico está cerrado'));
  }

  const form = await c.req.parseBody();
  const home = Number(form.home_score);
  const away = Number(form.away_score);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
    return c.redirect(`/partidos/${id}?err=` + encodeURIComponent('Marcador inválido'));
  }

  const isDraw = home === away;
  let penaltyWinner: 'home' | 'away' | null = null;
  if (match.is_knockout && isDraw) {
    const pw = String(form.penalty_winner || '');
    if (pw !== 'home' && pw !== 'away') {
      return c.redirect(`/partidos/${id}?err=` + encodeURIComponent('En eliminatoria, si pronosticás empate debés elegir quién gana por penales'));
    }
    penaltyWinner = pw;
  }

  const existing = await c.env.DB.prepare(
    'SELECT edit_count FROM predictions WHERE match_id=? AND user_id=?',
  ).bind(id, user.id).first<{ edit_count: number }>();

  if (existing) {
    if ((existing.edit_count ?? 0) >= 1) {
      return c.redirect(`/partidos/${id}?err=` + encodeURIComponent('Ya usaste el único cambio permitido para este pronóstico'));
    }
    await c.env.DB.prepare(
      `UPDATE predictions
       SET home_score=?, away_score=?, penalty_winner=?, updated_at=?, edit_count=edit_count+1
       WHERE match_id=? AND user_id=?`,
    ).bind(home, away, penaltyWinner, now, id, user.id).run();
    return c.redirect(`/partidos/${id}?ok=` + encodeURIComponent('Pronóstico actualizado (ya no se puede volver a cambiar)'));
  }

  await c.env.DB.prepare(
    `INSERT INTO predictions (match_id, user_id, home_score, away_score, penalty_winner, points, prize, edit_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, 0, 0, ?, ?)`,
  ).bind(id, user.id, home, away, penaltyWinner, now, now).run();

  return c.redirect(`/partidos/${id}?ok=` + encodeURIComponent('Pronóstico guardado'));
});

export default app;
