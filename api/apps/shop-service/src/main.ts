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
        host: 'localhost',
        port: 3001,
      },
    },
  );

  await app.listen();
}

bootstrap();
