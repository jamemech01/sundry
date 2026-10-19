
import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '../../../libs/prisma/generated/client';
import { PrismaService } from '../../../libs/prisma/prisma.service';
import { OrderService } from './order.service';

describe('OrderService', () => {
    const prisma = {
        shop: { findUnique: jest.fn() },
        product: { findMany: jest.fn() },
        order: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findUniqueOrThrow: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            updateMany: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    const service = new OrderService(prisma as unknown as PrismaService);

    beforeEach(() => jest.clearAllMocks());

    const order = {
        id: 1,
        buyerId: 20,
        status: OrderStatus.pending,
        shop: { userId: 10 },
    };

    it('rejects an empty order', async () => {
        await expect(
            service.create({
                buyerId: 20,
                shopId: 1,
                items: [],
                deliveryLat: 13.7,
                deliveryLng: 100.5,
            }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.shop.findUnique).not.toHaveBeenCalled();
    });

    it('rejects quantities less than or equal to zero', async () => {
        await expect(
            service.create({
                buyerId: 20,
                shopId: 1,
                items: [{ productId: 1, quantity: 0 }],
                deliveryLat: 13.7,
                deliveryLng: 100.5,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('rejects status updates by non-owners', async () => {
        prisma.order.findUnique.mockResolvedValue(order);

        await expect(
            service.updateStatus(1, 30, OrderStatus.accepted),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('allows the shop owner to accept a pending order', async () => {
        const acceptedOrder = { ...order, status: OrderStatus.accepted };
        prisma.order.findUnique.mockResolvedValue(order);
        prisma.order.updateMany.mockResolvedValue({ count: 1 });
        prisma.order.findUniqueOrThrow.mockResolvedValue(acceptedOrder);

        await expect(
            service.updateStatus(1, 10, OrderStatus.accepted),
        ).resolves.toEqual(acceptedOrder);
    });

    it('throws when an order is not visible to the user', async () => {
        prisma.order.findFirst.mockResolvedValue(null);

        await expect(service.findOne(1, 30)).rejects.toThrow(NotFoundException);
    });
});
