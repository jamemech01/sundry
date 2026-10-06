import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../../../libs/common/decorators/current-user.decorator';
import { JwtGuard } from '../../../libs/common/guards/jwt.guard';
import { CreateProductDto } from '../../../libs/contracts/product/create-product.dto';

@Controller('products')
export class ProductProxyController {
  constructor(
    @Inject('SHOP_SERVICE')
    private readonly shopClient: ClientProxy,
  ) {}

  @Post()
  @UseGuards(JwtGuard)
  create(@CurrentUser() user: { sub: number }, @Body() dto: CreateProductDto) {
    return firstValueFrom(
      this.shopClient.send(
        { cmd: 'product.create' },
        {
          userId: user.sub,
          ...dto,
        },
      ),
    );
  }

  @Get('shop/:shopId')
  findAll(@Param('shopId', ParseIntPipe) shopId: number) {
    return firstValueFrom(
      this.shopClient.send({ cmd: 'product.findAll' }, shopId),
    );
  }
}
