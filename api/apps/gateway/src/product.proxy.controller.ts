import {
  Body,
  Controller,
  Delete,
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
import { CreateProductDto } from '../../../libs/contracts/product/create-product.dto';
import { UpdateProductDto } from '../../../libs/contracts/product/update-product.dto';

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
  findAllByShop(@Param('shopId', ParseIntPipe) shopId: number) {
    return firstValueFrom(
      this.shopClient.send({ cmd: 'product.findAll' }, shopId),
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return firstValueFrom(this.shopClient.send({ cmd: 'product.findOne' }, id));
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  update(
    @CurrentUser() user: { sub: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return firstValueFrom(
      this.shopClient.send(
        { cmd: 'product.update' },
        {
          userId: user.sub,
          id,
          ...dto,
        },
      ),
    );
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  remove(
    @CurrentUser() user: { sub: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return firstValueFrom(
      this.shopClient.send(
        { cmd: 'product.remove' },
        {
          userId: user.sub,
          id,
        },
      ),
    );
  }
}
