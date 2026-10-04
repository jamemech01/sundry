import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
