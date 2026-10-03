import {
    Controller,
    Get,
    Inject,
    Post,
    Body,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('wallet')
export class WalletProxyController {
    constructor(
        @Inject('WALLET_SERVICE')
        private readonly walletClient: ClientProxy,
    ) { }

    @Get()
    get() {
        return firstValueFrom(
            this.walletClient.send({ cmd: 'wallet.get' }, 1),
        );
    }

    @Post('topup')
    topup(@Body() body: { amount: number }) {
        return firstValueFrom(
            this.walletClient.send(
                { cmd: 'wallet.topup' },
                {
                    userId: 1,
                    amount: body.amount,
                },
            ),
        );
    }
}