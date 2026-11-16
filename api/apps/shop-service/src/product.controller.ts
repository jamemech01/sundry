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
  }) {
    return this.productService.create(data.userId, data);
  }

  @MessagePattern({ cmd: 'product.findAll' })
  findAll(data: {
    shopId: number;
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  }) {
    return this.productService.findAll(
      data.shopId,
      data.page,
      data.limit,
      data.category,
      data.search,
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
    imageData?: string | null;
  }) {
    return this.productService.update(data.userId, data.id, {
      name: data.name,
      category: data.category,
      price: data.price,
      stock: data.stock,
      imageData: data.imageData,
    });
  }

  @MessagePattern({ cmd: 'product.remove' })
  remove(data: { userId: number; id: number }) {
    return this.productService.remove(data.userId, data.id);
  }
}
