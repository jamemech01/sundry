import {
  BadRequestException,
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
    if (data.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (data.stock !== undefined && data.stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

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
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    return this.prisma.product.findMany({
      where: { shopId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(
    userId: number,
    id: number,
    data: {
      name?: string;
      category?: string;
      price?: number;
      stock?: number;
      imageUrl?: string;
    },
  ) {
    if (data.price !== undefined && data.price < 0) {
      throw new BadRequestException('Price cannot be negative');
    }

    if (data.stock !== undefined && data.stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        shop: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.shop.userId !== userId) {
      throw new ForbiddenException('You do not own this product');
    }

    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async remove(userId: number, id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        shop: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.shop.userId !== userId) {
      throw new ForbiddenException('You do not own this product');
    }

    return this.prisma.product.delete({
      where: { id },
    });
  }
}
