import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { types } from 'pg';
import 'reflect-metadata';
import { AppModule } from './app.module';

// Keep SQL DATE values as plain 'YYYY-MM-DD' strings (no timezone shifting).
types.setTypeParser(types.builtins.DATE, (v: string) => v);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(Number(process.env.PORT ?? 3000));
  console.log(`Concrete API running on :${process.env.PORT ?? 3000}`);
}
void bootstrap();
