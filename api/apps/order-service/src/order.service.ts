import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '../../../libs/prisma/generated/client';
import { PrismaService } from '../../../libs/prisma/prisma.service';

const DELIVERY_FEE = new Prisma.Decimal(20);

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    buyerId: number;
    shopId: number;
    items: {
      productId: number;
      quantity: number;
    }[];
    deliveryLat: number;
    deliveryLng: number;
  }) {
    if (data.items.length === 0) {
      throw new BadRequestException('Order must contain items');
    }

    if (data.items.some((item) => item.quantity <= 0)) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const quantities = new Map<number, number>();

    for (const item of data.items) {
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: data.shopId },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: [...quantities.keys()],
        },
        shopId: data.shopId,
      },
    });

    if (products.length !== quantities.size) {
      throw new NotFoundException('Product not found');
    }

    const items = products.map((product) => {
      const quantity = quantities.get(product.id)!;

      if (product.stock < quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        price: product.price,
      };
    });

    const productTotal = items.reduce(
      (total, item) => total.plus(item.price.mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    const totalAmount = productTotal.plus(DELIVERY_FEE);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: data.buyerId },
      });

      if (!wallet) {
        throw new BadRequestException('Wallet not found');
      }

      const walletResult = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          balance: {
            gte: totalAmount,
          },
        },
        data: {
          balance: {
            decrement: totalAmount,
          },
        },
      });

      if (walletResult.count === 0) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      for (const item of items) {
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: {
              gte: item.quantity,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (result.count === 0) {
          throw new BadRequestException(
            `Insufficient stock for ${item.productName}`,
          );
        }
      }

      const order = await tx.order.create({
        data: {
          buyerId: data.buyerId,
          shopId: data.shopId,
          totalAmount,
          deliveryFee: DELIVERY_FEE,
          deliveryLat: data.deliveryLat,
          deliveryLng: data.deliveryLng,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          orderId: order.id,
          type: 'sale',
          amount: totalAmount,
        },
      });

      return order;
    });
  }

  async updateStatus(id: number, userId: number, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        shop: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.shop || order.shop.userId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.pending]: [OrderStatus.accepted, OrderStatus.rejected],
      [OrderStatus.accepted]: [OrderStatus.delivered],
      [OrderStatus.delivered]: [OrderStatus.completed],
      [OrderStatus.rejected]: [],
      [OrderStatus.completed]: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(
        `Cannot change order status from ${order.status} to ${status}`,
      );
    }

    if (status === OrderStatus.rejected) {
      return this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId: order.buyerId },
        });

        if (!wallet) {
          throw new NotFoundException('Buyer wallet not found');
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: {
              increment: order.totalAmount,
            },
          },
        });

        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
        });

        for (const item of items) {
          if (!item.productId) {
            continue;
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            orderId: order.id,
            type: 'refund',
            amount: order.totalAmount,
          },
        });

        return tx.order.update({
          where: { id: order.id },
          data: { status },
        });
      });
    }

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async findAll(userId: number) {
    return this.prisma.order.findMany({
      where: {
        OR: [
          { buyerId: userId },
          {
            shop: {
              userId,
            },
          },
        ],
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number, userId: number) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        OR: [
          { buyerId: userId },
          {
            shop: {
              userId,
            },
          },
        ],
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
