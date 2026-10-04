import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OrderServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: 'localhost',
        port: 3002,
      },
    },
  );

  await app.listen();
}

bootstrap();
