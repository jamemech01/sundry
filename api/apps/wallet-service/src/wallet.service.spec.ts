
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
    const tx = {
        transaction: { create: jest.fn() },
        wallet: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn(),
            findUniqueOrThrow: jest.fn(),
        },
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

    it.each([0, -1, NaN, Infinity, 1_000_001, 1.001])(
        'rejects invalid withdrawal amount: %s',
        async (amount) => {
            await expect(service.withdraw(10, amount)).rejects.toThrow(
                BadRequestException,
            );

            expect(prisma.$transaction).not.toHaveBeenCalled();
        },
    );

    it('debits the wallet and records a completed withdrawal', async () => {
        const wallet = { id: 1, userId: 10, balance: 75 };
        tx.wallet.findUnique.mockResolvedValue({ id: 1 });
        tx.wallet.updateMany.mockResolvedValue({ count: 1 });
        tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet);
        tx.transaction.create.mockResolvedValue({ id: 2 });

        await expect(service.withdraw(10, 25)).resolves.toEqual(wallet);

        expect(tx.wallet.updateMany).toHaveBeenCalledWith({
            where: {
                id: 1,
                balance: { gte: expect.anything() },
            },
            data: {
                balance: { decrement: expect.anything() },
            },
        });
        expect(tx.transaction.create).toHaveBeenCalledWith({
            data: {
                walletId: 1,
                type: 'withdrawal',
                status: 'completed',
                amount: expect.anything(),
            },
        });
    });

    it('accepts valid two-decimal withdrawal amounts', async () => {
        tx.wallet.findUnique.mockResolvedValue({ id: 1 });
        tx.wallet.updateMany.mockResolvedValue({ count: 1 });
        tx.wallet.findUniqueOrThrow.mockResolvedValue({
            id: 1,
            userId: 10,
            balance: 98.85,
        });

        await expect(service.withdraw(10, 1.15)).resolves.toMatchObject({
            balance: 98.85,
        });
    });

    it('rejects a withdrawal when the wallet balance is insufficient', async () => {
        tx.wallet.findUnique.mockResolvedValue({ id: 1 });
        tx.wallet.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.withdraw(10, 25)).rejects.toThrow(
            'Insufficient wallet balance',
        );

        expect(tx.transaction.create).not.toHaveBeenCalled();
    });
});
