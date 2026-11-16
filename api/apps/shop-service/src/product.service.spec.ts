
import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';
import { ProductService } from './product.service';

describe('ProductService', () => {
    const prisma = {
        shop: { findUnique: jest.fn() },
        product: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    };

    const service = new ProductService(prisma as unknown as PrismaService);

    beforeEach(() => jest.clearAllMocks());

    it('creates a product for the shop owner', async () => {
        const product = { id: 1, shopId: 2, name: 'Coffee', price: 50 };
        prisma.shop.findUnique.mockResolvedValue({ id: 2, userId: 10 });
        prisma.product.create.mockResolvedValue(product);

        await expect(
            service.create(10, {
                shopId: 2,
                name: 'Coffee',
                price: 50,
            }),
        ).resolves.toEqual(product);
    });

    it('rejects negative prices', async () => {
        await expect(
            service.create(10, { shopId: 2, name: 'Coffee', price: -1 }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.shop.findUnique).not.toHaveBeenCalled();
    });

    it('rejects users who do not own the shop', async () => {
        prisma.shop.findUnique.mockResolvedValue({ id: 2, userId: 20 });

        await expect(
            service.create(10, { shopId: 2, name: 'Coffee', price: 50 }),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('throws when the product does not exist', async () => {
        prisma.product.findUnique.mockResolvedValue(null);

        await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });

    it('sorts products by name and returns every shop category', async () => {
        const products = [{ id: 2, name: 'Apple' }];
        prisma.shop.findUnique.mockResolvedValue({ id: 2 });
        prisma.product.findMany
            .mockResolvedValueOnce(products)
            .mockResolvedValueOnce([
                { category: 'Food' },
                { category: 'Other' },
            ]);
        prisma.product.count
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(3);

        await expect(service.findAll(2, 1, 10, 'Food')).resolves.toMatchObject({
            items: products,
            total: 1,
            shopTotal: 3,
            categories: ['Food', 'Other'],
        });

        expect(prisma.product.findMany).toHaveBeenNthCalledWith(1, {
            where: { shopId: 2, category: 'Food' },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: 0,
            take: 10,
        });
        expect(prisma.product.findMany).toHaveBeenNthCalledWith(2, {
            where: { shopId: 2 },
            select: { category: true },
            distinct: ['category'],
            orderBy: { category: 'asc' },
        });
    });

    it('searches product names and categories without case sensitivity', async () => {
        prisma.shop.findUnique.mockResolvedValue({ id: 2 });
        prisma.product.findMany
            .mockResolvedValueOnce([{ id: 3, name: 'Iced Tea' }])
            .mockResolvedValueOnce([{ category: 'Drinks' }]);
        prisma.product.count
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(4);

        await expect(
            service.findAll(2, 1, 10, undefined, '  tea  '),
        ).resolves.toMatchObject({
            items: [{ id: 3, name: 'Iced Tea' }],
            total: 1,
            shopTotal: 4,
        });

        expect(prisma.product.findMany).toHaveBeenNthCalledWith(1, {
            where: {
                shopId: 2,
                OR: [
                    { name: { contains: 'tea', mode: 'insensitive' } },
                    { category: { contains: 'tea', mode: 'insensitive' } },
                ],
            },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: 0,
            take: 10,
        });
    });

    it('allows the shop owner to update an individual product image', async () => {
        prisma.product.findUnique.mockResolvedValue({
            id: 1,
            shop: { userId: 10 },
        });
        prisma.product.update.mockResolvedValue({
            id: 1,
            imageData: 'data:image/webp;base64,aGVsbG8=',
        });

        await expect(
            service.update(10, 1, {
                imageData: 'data:image/webp;base64,aGVsbG8=',
            }),
        ).resolves.toMatchObject({
            imageData: 'data:image/webp;base64,aGVsbG8=',
        });

        expect(prisma.product.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { imageData: 'data:image/webp;base64,aGVsbG8=' },
        });
    });
});
