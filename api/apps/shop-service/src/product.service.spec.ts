
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
            findUnique: jest.fn(),
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
});
