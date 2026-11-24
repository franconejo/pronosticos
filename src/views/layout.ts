import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { User } from '../types';

type LayoutProps = {
  title: string;
  user: User | null;
  body: HtmlEscapedString | string;
  flash?: { type: 'ok' | 'err'; message: string } | null;
};

export function layout({ title, user, body, flash }: LayoutProps) {
  const appName = 'Juego del Pronóstico';
  const description = 'Juego del Pronóstico, auspiciado por Caballeros del Ajedrez Paraguay y la Asociación Paraguaya de Ajedrecistas.';
  const pageTitle = `${title} - ${appName}`;
  return html`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${appName}" />
  <meta property="og:title" content="${appName}" />
  <meta property="og:description" content="${description}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${appName}" />
  <meta name="twitter:description" content="${description}" />
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <strong><a href="/">${appName}</a></strong>
        <div class="small">Pronósticos entre amigos</div>
      </div>
      <nav>
        <a href="/">Partidos</a>
        <a href="/tabla">Tabla mensual</a>
        ${user?.role === 'admin' ? html`<a href="/admin">Admin</a>` : ''}
        ${user
          ? html`<span class="badge">${user.nick}</span>
              <form class="inline" method="post" action="/logout"><button class="secondary" type="submit">Salir</button></form>`
          : html`<a href="/login">Entrar</a> <a href="/registro">Registrarme</a>`}
      </nav>
    </header>
    ${flash ? html`<div class="flash ${flash.type}">${flash.message}</div>` : ''}
    ${raw(body)}
  </div>
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
