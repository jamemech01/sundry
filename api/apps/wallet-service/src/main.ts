import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { WalletServiceModule } from './wallet-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WalletServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: process.env.WALLET_SERVICE_HOST ?? 'localhost',
        port: Number(process.env.WALLET_SERVICE_PORT ?? 3003),
      },
    },
  );

  await app.listen();
}

bootstrap();
