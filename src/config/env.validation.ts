import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(0)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  // Comma-separated list of allowed frontend origins (REST CORS + WebSocket
  // gateways) — see src/config/cors-origins.ts. Defaults to the Vite dev
  // server origin when unset.
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  R2_ACCOUNT_ID?: string;

  @IsString()
  @IsOptional()
  R2_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  R2_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  R2_BUCKET_NAME?: string;

  // This app's own public base URL — used to build /files?key=... links
  // (see FileUrlService) instead of R2's unreliable r2.dev public domain.
  @IsString()
  @IsOptional()
  API_PUBLIC_URL?: string;

  // Global ThrottlerModule limit (requests per IP per 60s), see app.module.ts.
  // Overridable so a load test can raise it temporarily without a code change.
  @IsNumber()
  @Min(1)
  @IsOptional()
  RATE_LIMIT_MAX: number = 60;

  // Max size of the pg.Pool the Prisma driver adapter wraps, see prisma.service.ts.
  @IsNumber()
  @Min(1)
  @IsOptional()
  DB_POOL_MAX: number = 10;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Ortam değişkenleri geçersiz:\n${errors.toString()}`);
  }
  return validated;
}
