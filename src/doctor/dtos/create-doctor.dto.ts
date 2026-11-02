import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// o corpo não traz perfil: o pipe descarta tudo que não está na classe: roles: ["admin"] é ignorado
export class CreateDoctorDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) // " Dra. Helena Souza " → "Dra. Helena Souza"; " " → 400
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  crm!: string;
}
