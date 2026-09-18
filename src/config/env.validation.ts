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

  @IsString()
  @IsOptional()
  R2_PUBLIC_URL?: string;
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
