import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  @Max(999999999)
  quantity: number;
}

export class CreateOrderDto {
  @IsInt()
  @Min(1)
  shopId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng: number;
}
