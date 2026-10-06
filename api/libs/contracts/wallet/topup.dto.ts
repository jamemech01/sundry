import { IsNumber, Max, Min } from 'class-validator';

export class TopupDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000)
  amount: number;
}
