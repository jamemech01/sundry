import { IsInt, Min } from "class-validator";
import { DeliveryLocationDto } from "./create-order.dto";

export class PreviewDeliveryFeeDto extends DeliveryLocationDto {
  @IsInt()
  @Min(1)
  shopId: number;
}
