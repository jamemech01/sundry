import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '../../../libs/prisma/generated/client';
import { PrismaService } from '../../../libs/prisma/prisma.service';

const BASE_DELIVERY_FEE = 20;
const BASE_DELIVERY_DISTANCE_METERS = 3000;
const EXTRA_FEE_PER_KM = 5;
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_TIMEOUT_MS = 8000;

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  private async calculateDeliveryFee(
    shopLat: number,
    shopLng: number,
    deliveryLat: number,
    deliveryLng: number,
  ): Promise<Prisma.Decimal> {
    const url =
      `${OSRM_BASE_URL}/` +
      `${shopLng},${shopLat};${deliveryLng},${deliveryLat}` +
      '?overview=false';

    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Unable to calculate delivery fee. Please try again later.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Delivery route service is unavailable.',
      );
    }

    let result: {
      code?: string;
      routes?: { distance: number }[];
    };

    try {
      result = (await response.json()) as {
        code?: string;
        routes?: { distance: number }[];
      };
    } catch {
      throw new ServiceUnavailableException(
        'Invalid response from delivery route service.',
      );
    }

    const distanceMeters = result.routes?.[0]?.distance;

    if (
      result.code !== 'Ok' ||
      typeof distanceMeters !== 'number' ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0
    ) {
      throw new ServiceUnavailableException(
        'Unable to find a valid delivery route.',
      );
    }

    const extraKilometers = Math.ceil(
      Math.max(0, distanceMeters - BASE_DELIVERY_DISTANCE_METERS) / 1000,
    );

    const deliveryFeeAmount =
      BASE_DELIVERY_FEE + extraKilometers * EXTRA_FEE_PER_KM;

    return new Prisma.Decimal(deliveryFeeAmount);
  }

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

    if (shop.userId === data.buyerId) {
      throw new BadRequestException('Cannot order from your own shop');
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

    // คำนวณค่าจัดส่งตามระยะทางถนนจริงจาก OSRM
    const deliveryFee = await this.calculateDeliveryFee(
      shop.lat,
      shop.lng,
      data.deliveryLat,
      data.deliveryLng,
    );

    const totalAmount = productTotal.plus(deliveryFee);

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
          deliveryFee,
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

    if (!order.shop) {
      throw new NotFoundException('Shop not found');
    }

    // ผู้ซื้อเป็นคนยืนยันรับสินค้าและทำให้คำสั่งซื้อเสร็จสมบูรณ์
    if (status === OrderStatus.completed) {
      if (order.buyerId !== userId) {
        throw new ForbiddenException('Only the buyer can complete this order');
      }

      if (order.status !== OrderStatus.delivered) {
        throw new BadRequestException('Only delivered orders can be completed');
      }

      return this.prisma.$transaction(async (tx) => {
        const result = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.delivered,
          },
          data: {
            status: OrderStatus.completed,
          },
        });

        if (result.count === 0) {
          throw new BadRequestException('Order has already been processed');
        }

        const sellerWallet = await tx.wallet.findUnique({
          where: {
            userId: order.shop!.userId,
          },
        });

        if (!sellerWallet) {
          throw new NotFoundException('Seller wallet not found');
        }

        // ผู้ขายได้รับทั้งค่าสินค้าและค่าจัดส่ง
        await tx.wallet.update({
          where: {
            id: sellerWallet.id,
          },
          data: {
            balance: {
              increment: order.totalAmount,
            },
          },
        });

        await tx.transaction.create({
          data: {
            walletId: sellerWallet.id,
            orderId: order.id,
            type: 'sale',
            amount: order.totalAmount,
          },
        });

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true },
        });
      });
    }

    // การเปลี่ยนสถานะอื่น ๆ ให้ผู้ขายเป็นผู้ดำเนินการ
    if (order.shop.userId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.pending]: [OrderStatus.accepted, OrderStatus.rejected],
      [OrderStatus.accepted]: [OrderStatus.delivered],
      [OrderStatus.delivered]: [],
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
        const result = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.pending,
          },
          data: {
            status: OrderStatus.rejected,
          },
        });

        if (result.count === 0) {
          throw new BadRequestException('Order has already been processed');
        }

        const wallet = await tx.wallet.findUnique({
          where: {
            userId: order.buyerId,
          },
        });

        if (!wallet) {
          throw new NotFoundException('Buyer wallet not found');
        }

        // คืนเงินเต็มจำนวน รวมค่าจัดส่ง
        await tx.wallet.update({
          where: {
            id: wallet.id,
          },
          data: {
            balance: {
              increment: order.totalAmount,
            },
          },
        });

        const items = await tx.orderItem.findMany({
          where: {
            orderId: order.id,
          },
        });

        // คืน Stock ให้สินค้าทุกชิ้นในคำสั่งซื้อ
        for (const item of items) {
          if (item.productId === null) {
            continue;
          }

          await tx.product.update({
            where: {
              id: item.productId,
            },
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

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true },
        });
      });
    }

    // ตรวจสถานะเดิมในฐานข้อมูลเพื่อป้องกันการเปลี่ยนสถานะซ้ำ
    const result = await this.prisma.order.updateMany({
      where: {
        id: order.id,
        status: order.status,
      },
      data: { status },
    });

    if (result.count === 0) {
      throw new BadRequestException('Order has already been processed');
    }

    return this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
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
