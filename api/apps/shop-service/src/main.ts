import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ShopServiceModule } from './shop-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ShopServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: process.env.SHOP_SERVICE_HOST ?? 'localhost',
        port: Number(process.env.SHOP_SERVICE_PORT ?? 3001),
      },
    },
  );

  await app.listen();
}

bootstrap();
