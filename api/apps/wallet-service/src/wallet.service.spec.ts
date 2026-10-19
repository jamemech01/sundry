
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
    const tx = {
        wallet: { upsert: jest.fn() },
        transaction: { create: jest.fn() },
    };

    const prisma = {
        wallet: { upsert: jest.fn() },
        $transaction: jest.fn(
            (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
        ),
    };

    const service = new WalletService(prisma as unknown as PrismaService);

    beforeEach(() => jest.clearAllMocks());

    it('gets or creates a wallet', async () => {
        const wallet = { id: 1, userId: 10, balance: 0 };
        prisma.wallet.upsert.mockResolvedValue(wallet);

        await expect(service.get(10)).resolves.toEqual(wallet);
        expect(prisma.wallet.upsert).toHaveBeenCalledWith({
            where: { userId: 10 },
            create: { userId: 10 },
            update: {},
        });
    });

    it.each([0, -1, NaN, Infinity, 1_000_001])(
        'rejects invalid top-up amount: %s',
        async (amount) => {
            await expect(service.topup(10, amount)).rejects.toThrow(
                BadRequestException,
            );

            expect(prisma.$transaction).not.toHaveBeenCalled();
        },
    );

    it('records a top-up transaction', async () => {
        const wallet = { id: 1, userId: 10, balance: 100 };
        tx.wallet.upsert.mockResolvedValue(wallet);
        tx.transaction.create.mockResolvedValue({ id: 1 });

        await expect(service.topup(10, 100)).resolves.toEqual(wallet);

        expect(tx.transaction.create).toHaveBeenCalledWith({
            data: {
                walletId: 1,
                type: 'topup',
                amount: expect.anything(),
            },
        });
    });
});
