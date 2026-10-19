
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({
    path: resolve(process.cwd(), '.env.test'),
    override: true,
    quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;

if (
    !databaseUrl ||
    new URL(databaseUrl).pathname.slice(1) !== 'sundry_test'
) {
    throw new Error('Integration tests must use the sundry_test database');
}

import { BadRequestException } from '@nestjs/common';
import {
    OrderStatus,
    Prisma,
} from '../../../libs/prisma/generated/client';
import { PrismaService } from '../../../libs/prisma/prisma.service';
import { OrderService } from './order.service';

describe('OrderService integration', () => {
    let prisma: PrismaService;
    let service: OrderService;
    let sellerId: number;
    let buyerId: number;
    let shopId: number;
    let productId: number;
    let buyerWalletId: number;
    let sellerWalletId: number;

    const originalFetch = global.fetch;

    beforeAll(async () => {
        prisma = new PrismaService();
        await prisma.$connect();
        service = new OrderService(prisma);
    });

    beforeEach(async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                code: 'Ok',
                routes: [{ distance: 2000 }],
            }),
        }) as unknown as typeof fetch;

        await prisma.transaction.deleteMany();
        await prisma.orderItem.deleteMany();
        await prisma.order.deleteMany();
        await prisma.product.deleteMany();
        await prisma.shop.deleteMany();
        await prisma.wallet.deleteMany();
        await prisma.user.deleteMany();

        const seller = await prisma.user.create({
            data: {
                username: `seller_${Date.now()}`,
                password: 'test-password',
            },
        });
        sellerId = seller.id;

        const buyer = await prisma.user.create({
            data: {
                username: `buyer_${Date.now()}`,
                password: 'test-password',
            },
        });
        buyerId = buyer.id;

        const shop = await prisma.shop.create({
            data: {
                name: 'Integration Test Shop',
                lat: 13.7,
                lng: 100.5,
                userId: sellerId,
            },
        });
        shopId = shop.id;

        const product = await prisma.product.create({
            data: {
                name: 'Test Product',
                price: new Prisma.Decimal('100.00'),
                stock: 10,
                shopId,
            },
        });
        productId = product.id;

        const buyerWallet = await prisma.wallet.create({
            data: {
                userId: buyerId,
                balance: new Prisma.Decimal('500.00'),
            },
        });
        buyerWalletId = buyerWallet.id;

        const sellerWallet = await prisma.wallet.create({
            data: {
                userId: sellerId,
                balance: new Prisma.Decimal('0.00'),
            },
        });
        sellerWalletId = sellerWallet.id;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    afterAll(async () => {
        if (prisma) {
            await prisma.$disconnect();
        }
    });

    it('creates an order and deducts wallet balance and stock', async () => {
        const order = await service.create({
            buyerId,
            shopId,
            items: [{ productId, quantity: 2 }],
            deliveryLat: 13.71,
            deliveryLng: 100.51,
        });

        expect(order.status).toBe(OrderStatus.pending);
        expect(order.items).toHaveLength(1);
        expect(order.totalAmount.toString()).toBe('220');

        const wallet = await prisma.wallet.findUniqueOrThrow({
            where: { id: buyerWalletId },
        });
        const product = await prisma.product.findUniqueOrThrow({
            where: { id: productId },
        });
        const transactions = await prisma.transaction.findMany({
            where: { orderId: order.id },
        });

        expect(wallet.balance.toString()).toBe('280');
        expect(product.stock).toBe(8);
        expect(transactions).toHaveLength(1);
        expect(transactions[0].type).toBe('sale');
    });

    it('does not change wallet or stock when balance is insufficient', async () => {
        await prisma.wallet.update({
            where: { id: buyerWalletId },
            data: { balance: new Prisma.Decimal('50.00') },
        });

        await expect(
            service.create({
                buyerId,
                shopId,
                items: [{ productId, quantity: 1 }],
                deliveryLat: 13.71,
                deliveryLng: 100.51,
            }),
        ).rejects.toThrow(BadRequestException);

        const wallet = await prisma.wallet.findUniqueOrThrow({
            where: { id: buyerWalletId },
        });
        const product = await prisma.product.findUniqueOrThrow({
            where: { id: productId },
        });
        const orders = await prisma.order.findMany();

        expect(wallet.balance.toString()).toBe('50');
        expect(product.stock).toBe(10);
        expect(orders).toHaveLength(0);
    });

    it('refunds the buyer and restores stock when the seller rejects an order', async () => {
        const order = await service.create({
            buyerId,
            shopId,
            items: [{ productId, quantity: 2 }],
            deliveryLat: 13.71,
            deliveryLng: 100.51,
        });

        const rejected = await service.updateStatus(
            order.id,
            sellerId,
            OrderStatus.rejected,
        );

        expect(rejected.status).toBe(OrderStatus.rejected);

        const wallet = await prisma.wallet.findUniqueOrThrow({
            where: { id: buyerWalletId },
        });
        const product = await prisma.product.findUniqueOrThrow({
            where: { id: productId },
        });
        const transactions = await prisma.transaction.findMany({
            where: { orderId: order.id },
            orderBy: { id: 'asc' },
        });

        expect(wallet.balance.toString()).toBe('500');
        expect(product.stock).toBe(10);
        expect(transactions.map((transaction) => transaction.type)).toEqual([
            'sale',
            'refund',
        ]);
    });

    it('transfers order amount to seller when buyer completes the order', async () => {
        const order = await service.create({
            buyerId,
            shopId,
            items: [{ productId, quantity: 2 }],
            deliveryLat: 13.71,
            deliveryLng: 100.51,
        });

        await service.updateStatus(
            order.id,
            sellerId,
            OrderStatus.accepted,
        );

        await service.updateStatus(
            order.id,
            sellerId,
            OrderStatus.delivered,
        );

        const completed = await service.updateStatus(
            order.id,
            buyerId,
            OrderStatus.completed,
        );

        expect(completed.status).toBe(OrderStatus.completed);

        const buyerWallet = await prisma.wallet.findUniqueOrThrow({
            where: { id: buyerWalletId },
        });
        const sellerWallet = await prisma.wallet.findUniqueOrThrow({
            where: { id: sellerWalletId },
        });
        const transactions = await prisma.transaction.findMany({
            where: { orderId: order.id },
            orderBy: { id: 'asc' },
        });

        expect(buyerWallet.balance.toString()).toBe('280');
        expect(sellerWallet.balance.toString()).toBe('220');
        expect(transactions.map((transaction) => transaction.type)).toEqual([
            'sale',
            'sale',
        ]);
    });
});
