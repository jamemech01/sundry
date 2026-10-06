import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { OrderStatus } from '../../../libs/prisma/generated/client';
import { OrderService } from './order.service';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

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
  findAll(data: { userId: number }) {
    return this.orderService.findAll(data.userId);
  }

  @MessagePattern({ cmd: 'order.findOne' })
  findOne(data: { id: number; userId: number }) {
    return this.orderService.findOne(data.id, data.userId);
  }

  @MessagePattern({ cmd: 'order.updateStatus' })
  updateStatus(data: { id: number; userId: number; status: OrderStatus }) {
    return this.orderService.updateStatus(data.id, data.userId, data.status);
  }
}
