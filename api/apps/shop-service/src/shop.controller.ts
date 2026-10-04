import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ShopService } from './shop.service';

@Controller()
export class ShopController {
    constructor(private readonly shopService: ShopService) { }

    @MessagePattern({ cmd: 'shop.create' })
    create(data: {
        userId: number;
        name: string;
        lat: number;
        lng: number;
    }) {
        return this.shopService.create(data.userId, data);
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
        return this.shopService.update(data.id, data.userId, {
            name: data.name,
            lat: data.lat,
            lng: data.lng,
        });
    }

    @MessagePattern({ cmd: 'shop.remove' })
    remove(data: { id: number; userId: number }) {
        return this.shopService.remove(data.id, data.userId);
    }
}