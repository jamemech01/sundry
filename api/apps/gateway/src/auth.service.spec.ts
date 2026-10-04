import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../../../libs/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const jwt = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwt,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('registers a user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 1,
      username: 'testuser',
    });

    const result = await service.register({
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(result).toEqual({
      id: 1,
      username: 'testuser',
    });
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    await expect(
      service.register({
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'different123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects existing username', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: 'testuser',
    });

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

    const result = await service.login({
      username: 'testuser',
      password: 'password123',
    });

    expect(result).toEqual({
      accessToken: 'token',
    });
  });

  it('rejects invalid login', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        username: 'testuser',
        password: 'wrongpass',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
