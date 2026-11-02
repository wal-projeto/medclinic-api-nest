// Responsabilidade: descreve e valida o que pode vir na URL da listagem (page, pageSize e name).
// O page e o pageSize vêm prontos da herança, e este arquivo só acrescenta o name.

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../@common/pagination/pagination-query.dto';

// extends: herda page e pageSize com todas as regras e padrões. Sem name na URL, não há filtro
export class ListDoctorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string; // O ? diz ao TypeScript que pode faltar
}
