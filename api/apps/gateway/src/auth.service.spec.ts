
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../../libs/prisma/generated/client';
import { PrismaService } from '../../../libs/prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn() };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('registers a user', async () => {
    prisma.user.create.mockResolvedValue({ id: 1, username: 'testuser' });

    await expect(
      service.register({
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'password123',
      }),
    ).resolves.toEqual({ id: 1, username: 'testuser' });
  });

  it('rejects mismatched passwords', async () => {
    await expect(
      service.register({
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'different123',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects an existing username', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );

    await expect(
      service.register({
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'password123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('logs in a user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: 'testuser',
      password: await bcrypt.hash('password123', 10),
    });
    jwt.signAsync.mockResolvedValue('token');

    await expect(
      service.login({ username: 'testuser', password: 'password123' }),
    ).resolves.toEqual({ accessToken: 'token' });
  });

  it('rejects invalid login', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ username: 'testuser', password: 'wrongpass' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
