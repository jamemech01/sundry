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

@Controller('orders')
export class OrderProxyController {
    constructor(
        @Inject('ORDER_SERVICE')
        private readonly orderClient: ClientProxy,
    ) { }

    @Post()
    create(
        @Body()
        body: {
            buyerId: number;
            shopId: number;
            items: {
                productId: number;
                quantity: number;
            }[];
            deliveryLat: number;
            deliveryLng: number;
        },
    ) {
        return firstValueFrom(
            this.orderClient.send({ cmd: 'order.create' }, body),
        );
    }

    @Get()
    findAll() {
        return firstValueFrom(
            this.orderClient.send({ cmd: 'order.findAll' }, {}),
        );
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return firstValueFrom(
            this.orderClient.send({ cmd: 'order.findOne' }, Number(id)),
        );
    }
}