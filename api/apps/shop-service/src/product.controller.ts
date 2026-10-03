import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ProductService } from './product.service';

@Controller()
export class ProductController {
    constructor(private readonly productService: ProductService) { }

    @MessagePattern({ cmd: 'product.create' })
    create(data: {
        shopId: number;
        name: string;
        category?: string;
        price: number;
        stock?: number;
        imageUrl?: string;
    }) {
        return this.productService.create(data);
    }

    @MessagePattern({ cmd: 'product.findAll' })
    findAll(shopId: number) {
        return this.productService.findAll(shopId);
    }
}