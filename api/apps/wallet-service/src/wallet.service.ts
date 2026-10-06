import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../libs/prisma/generated/client';
import { PrismaService } from '../../../libs/prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: number) {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async topup(userId: number, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (amount > 1_000_000) {
      throw new BadRequestException('Amount is too large');
    }

    const decimalAmount = new Prisma.Decimal(amount);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        create: {
          userId,
          balance: decimalAmount,
        },
        update: {
          balance: {
            increment: decimalAmount,
          },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'topup',
          amount: decimalAmount,
        },
      });

      return wallet;
    });
  }
}
