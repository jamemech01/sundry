import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../libs/prisma/prisma.service';

@Injectable()
export class ShopService {
    constructor(private readonly prisma: PrismaService) { }

    async create(
        userId: number,
        data: {
            name: string;
            lat: number;
            lng: number;
        },
    ) {
        return this.prisma.shop.create({
            data: {
                name: data.name,
                lat: data.lat,
                lng: data.lng,
                userId,
            },
        });
    }

    async findAll() {
        return this.prisma.shop.findMany({
            include: {
                products: true,
            },
        });
    }

    async findOne(id: number) {
        return this.prisma.shop.findUnique({
            where: { id },
            include: {
                products: true,
            },
        });
    }

    async update(
        id: number,
        data: {
            name?: string;
            lat?: number;
            lng?: number;
        },
    ) {
        return this.prisma.shop.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        return this.prisma.shop.delete({
            where: { id },
        });
    }
}