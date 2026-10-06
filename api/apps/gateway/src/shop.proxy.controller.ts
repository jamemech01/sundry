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
import { CreateShopDto } from '../../../libs/contracts/shop/create-shop.dto';
import { UpdateShopDto } from '../../../libs/contracts/shop/update-shop.dto';

@Controller('shops')
export class ShopProxyController {
  constructor(
    @Inject('SHOP_SERVICE')
    private readonly shopClient: ClientProxy,
  ) {}

  @Post()
  @UseGuards(JwtGuard)
  create(@CurrentUser() user: { sub: number }, @Body() dto: CreateShopDto) {
    return firstValueFrom(
      this.shopClient.send(
        { cmd: 'shop.create' },
        {
          userId: user.sub,
          ...dto,
        },
      ),
    );
  }

  @Get()
  findAll() {
    return firstValueFrom(this.shopClient.send({ cmd: 'shop.findAll' }, {}));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return firstValueFrom(this.shopClient.send({ cmd: 'shop.findOne' }, id));
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  update(
    @CurrentUser() user: { sub: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopDto,
  ) {
    return firstValueFrom(
      this.shopClient.send(
        { cmd: 'shop.update' },
        {
          id,
          userId: user.sub,
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
        { cmd: 'shop.remove' },
        {
          id,
          userId: user.sub,
        },
      ),
    );
  }
}
