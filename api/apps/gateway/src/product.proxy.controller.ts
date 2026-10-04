import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../../../libs/common/decorators/current-user.decorator';
import { JwtGuard } from '../../../libs/common/guards/jwt.guard';

@Controller('products')
export class ProductProxyController {
    constructor(
        @Inject('SHOP_SERVICE')
        private readonly shopClient: ClientProxy,
    ) { }

    @Post()
    @UseGuards(JwtGuard)
    create(
        @CurrentUser() user: { sub: number },
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
            this.shopClient.send(
                { cmd: 'product.create' },
                {
                    userId: user.sub,
                    ...body,
                },
            ),
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