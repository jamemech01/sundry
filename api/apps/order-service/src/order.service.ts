import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '../../../libs/prisma/generated/client';
import { PrismaService } from '../../../libs/prisma/prisma.service';

@Injectable()
export class OrderService {
    constructor(private readonly prisma: PrismaService) { }

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

        const shop = await this.prisma.shop.findUnique({
            where: { id: data.shopId },
        });

        if (!shop) {
            throw new NotFoundException('Shop not found');
        }

        const products = await this.prisma.product.findMany({
            where: {
                id: {
                    in: data.items.map((item) => item.productId),
                },
                shopId: data.shopId,
            },
        });

        if (products.length !== data.items.length) {
            throw new NotFoundException('Product not found');
        }

        const items = data.items.map((item) => {
            const product = products.find(
                (product) => product.id === item.productId,
            );

            if (!product) {
                throw new NotFoundException('Product not found');
            }

            if (product.stock < item.quantity) {
                throw new BadRequestException(
                    `Insufficient stock for ${product.name}`,
                );
            }

            return {
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                price: product.price,
            };
        });

        const totalAmount = items.reduce(
            (total, item) =>
                total + Number(item.price) * item.quantity,
            0,
        );

        return this.prisma.$transaction(async (tx) => {
            for (const item of data.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            decrement: item.quantity,
                        },
                    },
                });
            }

            return tx.order.create({
                data: {
                    buyerId: data.buyerId,
                    shopId: data.shopId,
                    totalAmount,
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
        });
    }

    async updateStatus(
        id: number,
        userId: number,
        status: OrderStatus,
    ) {
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
            throw new ForbiddenException(
                'You do not own this shop',
            );
        }

        if (
            order.status === OrderStatus.completed ||
            order.status === OrderStatus.rejected
        ) {
            throw new BadRequestException(
                'Order can no longer be updated',
            );
        }

        return this.prisma.order.update({
            where: { id },
            data: { status },
        });
    }

    async findAll() {
        return this.prisma.order.findMany({
            include: {
                items: true,
            },
        });
    }

    async findOne(id: number) {
        return this.prisma.order.findUnique({
            where: { id },
            include: {
                items: true,
            },
        });
    }
}