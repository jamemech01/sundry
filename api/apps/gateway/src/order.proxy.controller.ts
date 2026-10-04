import {
  Body,
  Controller,
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

@Controller('orders')
export class OrderProxyController {
  constructor(
    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientProxy,
  ) {}

  @Post()
  @UseGuards(JwtGuard)
  create(
    @CurrentUser() user: { sub: number },
    @Body()
    body: {
      shopId: number;
      items: {
        productId: number;
        quantity: number;
      }[];
      deliveryLat: number;
      deliveryLng: number;
    },
  ) {
    return firstValueFrom(
      this.orderClient.send(
        { cmd: 'order.create' },
        {
          buyerId: user.sub,
          ...body,
        },
      ),
    );
  }

  @Get()
  @UseGuards(JwtGuard)
  findAll() {
    return firstValueFrom(this.orderClient.send({ cmd: 'order.findAll' }, {}));
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  findOne(@Param('id') id: string) {
    return firstValueFrom(
      this.orderClient.send({ cmd: 'order.findOne' }, Number(id)),
    );
  }

  @Patch(':id/status')
  @UseGuards(JwtGuard)
  updateStatus(
    @CurrentUser() user: { sub: number },
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return firstValueFrom(
      this.orderClient.send(
        { cmd: 'order.updateStatus' },
        {
          id: Number(id),
          userId: user.sub,
          status: body.status,
        },
      ),
    );
  }
}
