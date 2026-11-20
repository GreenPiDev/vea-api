const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

// Read directly off process.env (not ConfigService) because WebSocketGateway
// decorator options are evaluated at import time, before Nest's DI container
// (and ConfigModule) exist. main.ts loads dotenv before importing AppModule
// so this still sees .env values in local dev; in prod the env is already
// injected via `docker run --env-file` before the process even starts.
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
