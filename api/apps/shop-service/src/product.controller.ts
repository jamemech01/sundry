import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ProductService } from './product.service';

@Controller()
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @MessagePattern({ cmd: 'product.create' })
  create(data: {
    userId: number;
    shopId: number;
    name: string;
    category?: string;
    price: number;
    stock?: number;
    imageUrl?: string;
  }) {
    return this.productService.create(data.userId, data);
  }

  @MessagePattern({ cmd: 'product.findAll' })
  findAll(data: { shopId: number; page?: number; limit?: number }) {
    return this.productService.findAll(
      data.shopId,
      data.page,
      data.limit,
    );
  }

  @MessagePattern({ cmd: 'product.findOne' })
  findOne(id: number) {
    return this.productService.findOne(id);
  }

  @MessagePattern({ cmd: 'product.update' })
  update(data: {
    userId: number;
    id: number;
    name?: string;
    category?: string;
    price?: number;
    stock?: number;
    imageUrl?: string;
  }) {
    return this.productService.update(data.userId, data.id, {
      name: data.name,
      category: data.category,
      price: data.price,
      stock: data.stock,
      imageUrl: data.imageUrl,
    });
  }

  @MessagePattern({ cmd: 'product.remove' })
  remove(data: { userId: number; id: number }) {
    return this.productService.remove(data.userId, data.id);
  }
}
