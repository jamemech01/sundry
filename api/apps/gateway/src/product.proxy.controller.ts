import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('products')
export class ProductProxyController {
    constructor(
        @Inject('SHOP_SERVICE')
        private readonly shopClient: ClientProxy,
    ) { }

    @Post()
    create(
        @Body()
        body: {
            shopId: number;
            name: string;
            category?: string;
            price: number;
            stock?: number;
            imageUrl?: string;
        },
    ) {
        return firstValueFrom(
            this.shopClient.send({ cmd: 'product.create' }, body),
        );
    }

    @Get('shop/:shopId')
    findAll(@Param('shopId') shopId: string) {
        return firstValueFrom(
            this.shopClient.send(
                { cmd: 'product.findAll' },
                Number(shopId),
            ),
        );
    }
}