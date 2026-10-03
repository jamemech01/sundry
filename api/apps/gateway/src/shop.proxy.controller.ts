import {
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('shops')
export class ShopProxyController {
    constructor(
        @Inject('SHOP_SERVICE')
        private readonly shopClient: ClientProxy,
    ) { }

    @Post()
    create(
        @Body()
        body: {
            userId: number;
            name: string;
            lat: number;
            lng: number;
        },
    ) {
        return firstValueFrom(
            this.shopClient.send({ cmd: 'shop.create' }, body),
        );
    }

    @Get()
    findAll() {
        return firstValueFrom(
            this.shopClient.send({ cmd: 'shop.findAll' }, {}),
        );
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return firstValueFrom(
            this.shopClient.send({ cmd: 'shop.findOne' }, Number(id)),
        );
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body()
        body: {
            name?: string;
            lat?: number;
            lng?: number;
        },
    ) {
        return firstValueFrom(
            this.shopClient.send(
                { cmd: 'shop.update' },
                {
                    id: Number(id),
                    ...body,
                },
            ),
        );
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return firstValueFrom(
            this.shopClient.send({ cmd: 'shop.remove' }, Number(id)),
        );
    }
}