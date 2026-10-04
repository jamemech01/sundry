import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: number,
    data: {
      shopId: number;
      name: string;
      category?: string;
      price: number;
      stock?: number;
      imageUrl?: string;
    },
  ) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: data.shopId },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    if (shop.userId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }

    return this.prisma.product.create({
      data: {
        shopId: data.shopId,
        name: data.name,
        category: data.category,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl,
      },
    });
  }

  async findAll(shopId: number) {
    return this.prisma.product.findMany({
      where: { shopId },
    });
  }
}
