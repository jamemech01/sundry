import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../../../libs/common/decorators/current-user.decorator';
import { JwtGuard } from '../../../libs/common/guards/jwt.guard';

@Controller('wallet')
@UseGuards(JwtGuard)
export class WalletProxyController {
  constructor(
    @Inject('WALLET_SERVICE')
    private readonly walletClient: ClientProxy,
  ) {}

  @Get()
  get(@CurrentUser() user: { sub: number }) {
    return firstValueFrom(
      this.walletClient.send({ cmd: 'wallet.get' }, user.sub),
    );
  }

  @Post('topup')
  topup(
    @CurrentUser() user: { sub: number },
    @Body() body: { amount: number },
  ) {
    return firstValueFrom(
      this.walletClient.send(
        { cmd: 'wallet.topup' },
        {
          userId: user.sub,
          amount: body.amount,
        },
      ),
    );
  }
}
