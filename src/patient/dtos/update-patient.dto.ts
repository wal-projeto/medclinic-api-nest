import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// O único campo que a alteração aceita é o nome; o CPF identifica o paciente e não muda
export class UpdatePatientDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
//Não existe cpf aqui. Como o pipe global tem whitelist: true, um cpf mandado
// no corpo é removido antes de chegar ao controller
