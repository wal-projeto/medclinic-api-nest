import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLES, type Role } from '../user.entity';

export class CreateUserDto {
  // Registra: "antes de validar, passe o name por esta função". Roda quando o pipe fabrica a instância
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string; // " "  ou número dão 400

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsArray()
  @ArrayNotEmpty() // a lista não pode ser [ ]
  @IsIn(ROLES, { each: true }) // cada item tem que ser um dos perfis ["batata"] dá 400
  roles!: Role[]; // o ! diz ao TypeScript; "o valor chega preenchido, o pipe garante"
}
