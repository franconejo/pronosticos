# Juego del Pronóstico - Caballeros del Ajedrez Paraguay

Aplicación web para organizar y llevar el control del **Juego del Pronóstico** que se realiza en el grupo de WhatsApp **Caballeros del Ajedrez Paraguay**.

Este proyecto nació con la intención de darle una mejor calidad de vida (QoL) al juego: facilitar la carga de pronósticos, el cálculo de puntos, la tabla mensual y el control de premios, evitando llevar todo a mano en el chat.

Si el código funciona correctamente, la intención es publicarlo en **caballeros.eibrapp.com.py**.

## Sobre el juego

Este juego de pronóstico **no es una casa de apuestas**. Es una manera divertida de regalar dinero a amigos del grupo.

Juego financiado por el **Ing. Fernando Javier Saldaña Ingolotti**, en colaboración con **César A. Franco** (tesorero y desarrollador de este repositorio).

## Qué hace la aplicación

- **Registro de jugadores**: nick público, nombre real, teléfono, banco y alias/cuenta bancaria. Los datos sensibles quedan visibles solo para el administrador.
- **Usuarios temporales**: el administrador puede crear usuarios temporales para quienes todavía no ingresaron al link. Si luego la persona se registra con el mismo número de teléfono, el sistema le permite reclamar esa cuenta y conservar su historial.
- **Fusión de cuentas**: si hace falta, el administrador puede fusionar un usuario temporal con un usuario registrado, trasladando pronósticos y premios mensuales.
- **Login**: acceso con teléfono y PIN.
- **Gestión de partidos**: el administrador crea partidos, define horario de cierre, premio base, si es eliminatoria, y carga el resultado final (incluyendo ganador por penales si corresponde).
- **Carga de pronósticos**: cada jugador puede cargar o editar su pronóstico mientras el partido esté abierto y antes del cierre. En partidos de eliminatoria, si pronostica empate debe indicar quién gana por penales.
- **Cálculo automático de puntos**:
  - 6 puntos por acertar el resultado exacto.
  - 3 puntos por acertar ganador o empate (sin exacto).
  - 1 punto por participar.
  - En eliminatorias con empate: si se acierta marcador y ganador por penales, 6 puntos; si se acierta marcador pero no el ganador por penales, 3 puntos (o 6 sin premio si nadie acertó el exacto completo con penales).
- **Premios por partido**: cobran quienes aciertan el resultado exacto.
  - Si hay varios ganadores exactos, cada uno recibe el premio base.
  - Si hay un solo ganador exacto, el premio se duplica (25.000 → 50.000, 30.000 → 60.000, 50.000 → 100.000, etc.).
- **Tabla mensual**: suma puntos del mes, muestra ranking público por nick y permite al administrador revisar/aprobar premios mensuales.
- **Premios mensuales con empates**: el sistema sugiere el reparto por bolsas ocupadas y el administrador tiene la última palabra para aceptar o ajustar el reparto en casos especiales.

## Stack

- **Cloudflare Workers**: backend y renderizado de la aplicación.
- **Hono**: framework web liviano para Workers.
- **Cloudflare D1**: base de datos SQLite administrada.
- **TypeScript**: lenguaje principal del proyecto.
- **HTML/CSS**: interfaz simple renderizada desde el servidor.
- **Wrangler**: CLI para desarrollo y despliegue en Cloudflare.

## Estructura del proyecto

```text
public/
  style.css
src/
  db/schema.sql
  lib/
    auth.ts
    prizes.ts
    scoring.ts
    time.ts
  routes/
    admin.ts
    picks.ts
    public.ts
  views/
    layout.ts
  index.ts
  types.ts
```

## Desarrollo local

```powershell
# 1) Instalar dependencias
npm install
```

```powershell
# 2) Crear base D1 (primera vez)
npx wrangler d1 create pronostico-db
```

Copiá el `database_id` en `wrangler.toml`.

```powershell
# 3) Aplicar esquema en local
npm run db:init
```

```powershell
# 4) Levantar entorno de desarrollo
npm run dev
```

## Despliegue

```powershell
# 1) Aplicar esquema en remoto
npm run db:init:remote
```

```powershell
# 2) Publicar
npm run deploy
```

## Estado

MVP en desarrollo. El primer usuario registrado queda como administrador para el arranque inicial del sistema.
