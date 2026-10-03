import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../libs/prisma/prisma.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
    imports: [PrismaModule],
    controllers: [ShopController, ProductController],
    providers: [ShopService, ProductService],
})
export class ShopServiceModule { }