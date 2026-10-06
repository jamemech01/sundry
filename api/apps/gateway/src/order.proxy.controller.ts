import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../../../libs/common/decorators/current-user.decorator';
import { JwtGuard } from '../../../libs/common/guards/jwt.guard';
import { CreateOrderDto } from '../../../libs/contracts/order/create-order.dto';
import { UpdateOrderStatusDto } from '../../../libs/contracts/order/update-order-status.dto';

@Controller('orders')
export class OrderProxyController {
  constructor(
    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientProxy,
  ) {}

  @Post()
  @UseGuards(JwtGuard)
  create(@CurrentUser() user: { sub: number }, @Body() dto: CreateOrderDto) {
    return firstValueFrom(
      this.orderClient.send(
        { cmd: 'order.create' },
        {
          buyerId: user.sub,
          ...dto,
        },
      ),
    );
  }

  @Get()
  @UseGuards(JwtGuard)
  findAll(@CurrentUser() user: { sub: number }) {
    return firstValueFrom(
      this.orderClient.send({ cmd: 'order.findAll' }, { userId: user.sub }),
    );
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  findOne(
    @CurrentUser() user: { sub: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return firstValueFrom(
      this.orderClient.send(
        { cmd: 'order.findOne' },
        {
          id,
          userId: user.sub,
        },
      ),
    );
  }

  @Patch(':id/status')
  @UseGuards(JwtGuard)
  updateStatus(
    @CurrentUser() user: { sub: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return firstValueFrom(
      this.orderClient.send(
        { cmd: 'order.updateStatus' },
        {
          id,
          userId: user.sub,
          status: dto.status,
        },
      ),
    );
  }
}
