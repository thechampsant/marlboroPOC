import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  // Camera photos are sent as base64 JSON; raise the body limit well above the 100kb default
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  // Serve index.html and static assets from the project root
  app.useStaticAssets(path.join(__dirname, '..', '..'));
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\nServer running → http://localhost:${port}`);
  console.log(`Open on phone   → http://<your-machine-ip>:${port}`);
  console.log(`(Camera requires HTTPS or localhost — use ngrok for phone testing)\n`);
}
bootstrap();
