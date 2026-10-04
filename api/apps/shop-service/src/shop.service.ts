import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: number,
    data: {
      name: string;
      lat: number;
      lng: number;
    },
  ) {
    return this.prisma.shop.create({
      data: {
        name: data.name,
        lat: data.lat,
        lng: data.lng,
        userId,
      },
    });
  }

  async findAll() {
    return this.prisma.shop.findMany({
      include: {
        products: true,
      },
    });
  }

  async findOne(id: number) {
    return this.prisma.shop.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });
  }

  async update(
    id: number,
    userId: number,
    data: {
      name?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    if (shop.userId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }

    return this.prisma.shop.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, userId: number) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    if (shop.userId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }

    return this.prisma.shop.delete({
      where: { id },
    });
  }
}
