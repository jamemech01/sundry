import {
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class RegisterDto {
    @IsString()
    @MinLength(3)
    @MaxLength(20)
    @Matches(/^[a-zA-Z0-9_]+$/)
    username: string;

    @IsString()
    @MinLength(8)
    @MaxLength(50)
    password: string;

    @IsString()
    @MinLength(8)
    @MaxLength(50)
    confirmPassword: string;
}