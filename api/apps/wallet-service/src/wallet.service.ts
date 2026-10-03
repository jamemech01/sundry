import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';

@Injectable()
export class WalletService {
    constructor(private readonly prisma: PrismaService) { }

    async get(userId: number) {
        return this.prisma.wallet.upsert({
            where: { userId },
            create: { userId },
            update: {},
        });
    }

    async topup(userId: number, amount: number) {
        if (amount <= 0) {
            throw new BadRequestException('Amount must be greater than 0');
        }

        return this.prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.upsert({
                where: { userId },
                create: {
                    userId,
                    balance: amount,
                },
                update: {
                    balance: {
                        increment: amount,
                    },
                },
            });

            await tx.transaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'topup',
                    amount,
                },
            });

            return wallet;
        });
    }
}