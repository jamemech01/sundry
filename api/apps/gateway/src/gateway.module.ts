import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../../libs/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OrderProxyController } from './order.proxy.controller';
import { ProductProxyController } from './product.proxy.controller';
import { ShopProxyController } from './shop.proxy.controller';
import { WalletProxyController } from './wallet.proxy.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '10m',
        },
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
      {
        name: 'SHOP_SERVICE',
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('SHOP_SERVICE_HOST', 'localhost'),
            port: Number(config.get<string>('SHOP_SERVICE_PORT', '3001')),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('ORDER_SERVICE_HOST', 'localhost'),
            port: Number(config.get<string>('ORDER_SERVICE_PORT', '3002')),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'WALLET_SERVICE',
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('WALLET_SERVICE_HOST', 'localhost'),
            port: Number(config.get<string>('WALLET_SERVICE_PORT', '3003')),
          },
        }),
        inject: [ConfigService],
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
