import {
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../../../libs/common/decorators/current-user.decorator';
import { JwtGuard } from '../../../libs/common/guards/jwt.guard';

@Controller('shops')
export class ShopProxyController {
    constructor(
        @Inject('SHOP_SERVICE')
        private readonly shopClient: ClientProxy,
    ) { }

    @Post()
    @UseGuards(JwtGuard)
    create(
        @CurrentUser() user: { sub: number },
        @Body()
        body: {
            name: string;
            lat: number;
            lng: number;
        },
    ) {
        return firstValueFrom(
            this.shopClient.send(
                { cmd: 'shop.create' },
                {
                    userId: user.sub,
                    ...body,
                },
            ),
        );
    }

    @Get()
    findAll() {
        return firstValueFrom(
            this.shopClient.send({ cmd: 'shop.findAll' }, {}),
        );
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return firstValueFrom(
            this.shopClient.send({ cmd: 'shop.findOne' }, Number(id)),
        );
    }

    @Patch(':id')
    @UseGuards(JwtGuard)
    update(
        @CurrentUser() user: { sub: number },
        @Param('id') id: string,
        @Body()
        body: {
            name?: string;
            lat?: number;
            lng?: number;
        },
    ) {
        return firstValueFrom(
            this.shopClient.send(
                { cmd: 'shop.update' },
                {
                    id: Number(id),
                    userId: user.sub,
                    ...body,
                },
            ),
        );
    }

    @Delete(':id')
    @UseGuards(JwtGuard)
    remove(
        @CurrentUser() user: { sub: number },
        @Param('id') id: string,
    ) {
        return firstValueFrom(
            this.shopClient.send(
                { cmd: 'shop.remove' },
                {
                    id: Number(id),
                    userId: user.sub,
                },
            ),
        );
    }
}