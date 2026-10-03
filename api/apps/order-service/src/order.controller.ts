import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
    constructor(private readonly orderService: OrderService) { }

    @MessagePattern({ cmd: 'order.create' })
    create(data: {
        buyerId: number;
        shopId: number;
        items: {
            productId: number;
            quantity: number;
        }[];
        deliveryLat: number;
        deliveryLng: number;
    }) {
        return this.orderService.create(data);
    }

    @MessagePattern({ cmd: 'order.findAll' })
    findAll() {
        return this.orderService.findAll();
    }

    @MessagePattern({ cmd: 'order.findOne' })
    findOne(id: number) {
        return this.orderService.findOne(id);
    }
}