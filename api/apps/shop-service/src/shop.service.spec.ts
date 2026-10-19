
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';
import { ShopService } from './shop.service';

describe('ShopService', () => {
    const prisma = {
        shop: {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    };

    const service = new ShopService(prisma as unknown as PrismaService);

    beforeEach(() => jest.clearAllMocks());

    it('creates a shop for the user', async () => {
        const shop = { id: 1, userId: 10, name: 'Test Shop' };
        prisma.shop.create.mockResolvedValue(shop);

        await expect(
            service.create(10, { name: 'Test Shop', lat: 13.7, lng: 100.5 }),
        ).resolves.toEqual(shop);

        expect(prisma.shop.create).toHaveBeenCalledWith({
            data: { name: 'Test Shop', lat: 13.7, lng: 100.5, userId: 10 },
        });
    });

    it('rejects updates by non-owners', async () => {
        prisma.shop.findUnique.mockResolvedValue({ id: 1, userId: 20 });

        await expect(
            service.update(1, 10, { name: 'Updated Shop' }),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.shop.update).not.toHaveBeenCalled();
    });

    it('throws when the shop does not exist', async () => {
        prisma.shop.findUnique.mockResolvedValue(null);

        await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
});
