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
  const description = 'Auspiciado por Caballeros del Ajedrez Paraguay y la Asociación Paraguaya de Ajedrecistas.';
  const pageTitle = `${title} - ${appName}`;
  return html`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#171717" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>${pageTitle}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${appName}" />
  <meta property="og:title" content="${appName}" />
  <meta property="og:description" content="${description}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${appName}" />
  <meta name="twitter:description" content="${description}" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-inner wrap">
        <a class="brand" href="/">
          <span class="brand-mark">JP</span>
          <span class="brand-text">
            <strong>${appName}</strong>
            <span>Caballeros del Ajedrez Paraguay</span>
          </span>
        </a>
        <nav class="main-nav" aria-label="Principal">
          <a href="/" class="nav-link">Partidos</a>
          <a href="/tabla" class="nav-link">Tabla</a>
          ${user?.role === 'admin' ? html`<a href="/admin" class="nav-link">Admin</a>` : ''}
          ${user
            ? html`<form class="inline" method="post" action="/logout"><button class="nav-link nav-button" type="submit">Salir</button></form>`
            : html`<a href="/registro" class="nav-link">Registro</a><a href="/login" class="nav-link nav-primary">Entrar</a>`}
        </nav>
      </div>
    </header>

    <main class="page wrap">
      ${user ? html`<div class="user-strip"><span class="user-chip">Sesión: <strong>${user.nick}</strong></span></div>` : ''}
      ${flash ? html`<div class="flash ${flash.type}" role="status">${flash.message}</div>` : ''}
      ${raw(body)}
    </main>

    <footer class="site-footer wrap">
      <span>Auspiciado por Caballeros del Ajedrez Paraguay y la Asociación Paraguaya de Ajedrecistas.</span>
    </footer>
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
