import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../libs/prisma/generated/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
