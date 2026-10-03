import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { WalletService } from './wallet.service';

@Controller()
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @MessagePattern({ cmd: 'wallet.get' })
    get(userId: number) {
        return this.walletService.get(userId);
    }

    @MessagePattern({ cmd: 'wallet.topup' })
    topup(data: { userId: number; amount: number }) {
        return this.walletService.topup(data.userId, data.amount);
    }
}