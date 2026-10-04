import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OrderProxyController } from './order.proxy.controller';
import { ProductProxyController } from './product.proxy.controller';
import { ShopProxyController } from './shop.proxy.controller';
import { WalletProxyController } from './wallet.proxy.controller';
import { PrismaModule } from '../../../libs/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '10m',
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    ClientsModule.register([
      {
        name: 'SHOP_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3001,
        },
      },
      {
        name: 'ORDER_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3002,
        },
      },
      {
        name: 'WALLET_SERVICE',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3003,
        },
      },
    ]),
  ],
  controllers: [
    AuthController,
    ShopProxyController,
    ProductProxyController,
    OrderProxyController,
    WalletProxyController,
  ],
  providers: [AuthService, JwtStrategy],
})
export class GatewayModule {}
