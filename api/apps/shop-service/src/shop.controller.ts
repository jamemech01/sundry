import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ShopService } from './shop.service';

@Controller()
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @MessagePattern({ cmd: 'shop.create' })
  create(data: { userId: number; name: string; lat: number; lng: number }) {
    const { userId, ...shopData } = data;

    return this.shopService.create(userId, shopData);
  }

  @MessagePattern({ cmd: 'shop.findAll' })
  findAll() {
    return this.shopService.findAll();
  }

  @MessagePattern({ cmd: 'shop.findOne' })
  findOne(id: number) {
    return this.shopService.findOne(id);
  }

  @MessagePattern({ cmd: 'shop.update' })
  update(data: {
    id: number;
    userId: number;
    name?: string;
    lat?: number;
    lng?: number;
  }) {
    const { id, userId, ...shopData } = data;

    return this.shopService.update(id, userId, shopData);
  }

  @MessagePattern({ cmd: 'shop.remove' })
  remove(data: { id: number; userId: number }) {
    return this.shopService.remove(data.id, data.userId);
  }
}
