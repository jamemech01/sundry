import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../../libs/prisma/generated/client';
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

  async getTransactions(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!wallet) {
      return [];
    }

    return this.prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
      },
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        orderId: true,
        createdAt: true,
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
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

  async withdraw(userId: number, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      throw new BadRequestException(
        'Amount must be greater than 0 and no more than 1,000,000',
      );
    }

    if (Number(amount.toFixed(2)) !== amount) {
      throw new BadRequestException('Amount can have at most 2 decimal places');
    }

    const decimalAmount = new Prisma.Decimal(amount);

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!wallet) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const result = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          balance: { gte: decimalAmount },
        },
        data: {
          balance: { decrement: decimalAmount },
        },
      });

      if (result.count === 0) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const updatedWallet = await tx.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'withdrawal',
          status: 'completed',
          amount: decimalAmount,
        },
      });

      return updatedWallet;
    });
  }
}
