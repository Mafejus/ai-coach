# Claude Code — Deploy na Railway

## Kontext
Přečti si `architecture.md`. Celá aplikace je hotová a funguje lokálně. Teď ji nasadíme na Railway.

---

## 1. Railway projekt — 4 services

Potřebujeme 4 services v jednom Railway projektu:

### Service 1: PostgreSQL
- Railway managed PostgreSQL
- Automatické backupy
- Proměnná `DATABASE_URL` se automaticky propojí

### Service 2: Redis
- Railway managed Redis
- Proměnná `REDIS_URL` se automaticky propojí

### Service 3: Web (Next.js)
- Source: GitHub repo
- Root directory: `/`
- Build command: `npm install && npx turbo build --filter=@ai-coach/web`
- Start command: `cd apps/web && npm start`
- Port: 3000
- Health check: `/api/health`

### Service 4: Worker (BullMQ)
- Source: GitHub repo (stejný repo)
- Root directory: `/`
- Build command: `npm install && npx turbo build --filter=@ai-coach/worker`
- Start command: `cd apps/worker && npm start`
- Žádný port (background only)

---

## 2. Připrav projekt na deploy

### A) Přidej `start` script do apps/web/package.json:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p ${PORT:-3000}"
  }
}
```

### B) Přidej `start` script do apps/worker/package.json:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### C) Worker musí mít `tsconfig.json` s outDir:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "commonjs",
    "target": "es2022",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### D) Prisma — generuj klienta při buildu:
V `packages/db/package.json` přidej postinstall:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && tsc"
  }
}
```

### E) Root package.json — přidej engine:
```json
{
  "engines": {
    "node": ">=20"
  }
}
```

### F) Vytvoř `Procfile` nebo `railway.toml` v rootu (volitelné):
```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

### G) Environment variables pro Railway:

Tyto proměnné musíš nastavit v Railway dashboard pro WEB service:
```
# Auth
NEXTAUTH_URL=https://tvoje-domena.up.railway.app
NEXTAUTH_SECRET=<stejný jako lokálně>
AUTH_SECRET=<stejný jako NEXTAUTH_SECRET>
AUTH_TRUST_HOST=true

# Google OAuth
GOOGLE_CLIENT_ID=<z Google Cloud Console>
GOOGLE_CLIENT_SECRET=<z Google Cloud Console>

# Strava
STRAVA_CLIENT_ID=<ze Strava API>
STRAVA_CLIENT_SECRET=<ze Strava API>

# Garmin
GARMIN_ENCRYPTION_KEY=<stejný jako lokálně>

# AI
GOOGLE_AI_API_KEY=<z Google AI Studio>

# DB a Redis se propojí automaticky přes Railway references:
# DATABASE_URL=${{Postgres.DATABASE_URL}}
# REDIS_URL=${{Redis.REDIS_URL}}
```

Pro WORKER service — stejné proměnné, plus:
```
# DATABASE_URL=${{Postgres.DATABASE_URL}}
# REDIS_URL=${{Redis.REDIS_URL}}
```

### H) Google OAuth — přidej production redirect URI:

V Google Cloud Console → Credentials → tvůj OAuth Client:
- Přidej Authorized redirect URI: `https://tvoje-domena.up.railway.app/api/auth/callback/google`
- Nech tam i `http://localhost:3000/api/auth/callback/google` (pro lokální dev)

### I) Strava — přidej production callback domain:

Na strava.com/settings/api → tvoje aplikace:
- Authorization Callback Domain: přidej `tvoje-domena.up.railway.app` (bez https://, bez cesty)

---

## 3. Prisma migrace na produkci

Přidej migrate script do CI nebo manuálně:

V `packages/db/package.json`:
```json
{
  "scripts": {
    "migrate:deploy": "prisma migrate deploy"
  }
}
```

Migrace se spustí buď:
- Manuálně přes Railway shell: `cd packages/db && npx prisma migrate deploy`
- Nebo přidej do build commandu web service: `npm install && cd packages/db && npx prisma migrate deploy && cd ../.. && npx turbo build --filter=@ai-coach/web`

---

## 4. Ověř build lokálně

Před deployem ověř že produkční build funguje:

```bash
# Vyčisti cache
npx turbo clean

# Produkční build
npx turbo build

# Test start
cd apps/web && npm start
```

Pokud build selže, oprav chyby.

---

## 5. Optimalizace pro produkci

### A) Next.js config — standalone output:
```typescript
// apps/web/next.config.ts
const config = {
  output: 'standalone',
  // ... zbytek configu
};
```
Standalone output zmenší deploy size (neposílá celé node_modules).

Pokud použiješ standalone, uprav start command:
```
Start command: node apps/web/.next/standalone/apps/web/server.js
```

### B) Prisma — optimalizuj pro produkci:
```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

### C) Logování:
- Přidej structured logging (JSON format) pro lepší Railway log viewer
- Loguj: sync úspěchy/selhání, AI API cally, auth eventy

---

## 6. Po deployi zkontroluj

1. Web: `https://tvoje-domena.up.railway.app` → login stránka
2. Health: `https://tvoje-domena.up.railway.app/api/health` → 200 OK
3. Google login funguje (s produkční redirect URI)
4. Strava OAuth funguje
5. Garmin sync funguje
6. AI chat odpovídá
7. Worker: cron joby běží (zkontroluj Railway logs pro worker service)
8. PWA: otevři na telefonu v Safari/Chrome → "Přidat na plochu"

---

## Technické požadavky
- `npx turbo build` MUSÍ projít bez chyb před commitem
- Všechny env proměnné zdokumentované v `.env.example`
- Žádné hardcoded localhost URLs v kódu (použij `process.env.NEXTAUTH_URL` nebo relativní cesty)
- CORS: žádné extra nastavení potřeba (Next.js API routes jsou same-origin)
