import { Injectable } from '@nestjs/common';
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
        const products = await this.prisma.product.findMany({
            where: {
                id: {
                    in: data.items.map((item) => item.productId),
                },
                shopId: data.shopId,
            },
        });

        if (products.length !== data.items.length) {
            throw new Error('Product not found');
        }

        const items = data.items.map((item) => {
            const product = products.find(
                (product) => product.id === item.productId,
            );

            if (!product) {
                throw new Error('Product not found');
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

        return this.prisma.order.create({
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