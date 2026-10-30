import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../@common/pagination/pagination-query.dto';

//extends: este DTO herda page e pageSize com todas as regras e padrões : sem name na URL, não há filtro
export class ListPatientsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string; // O ? diz ao TypeScript que pode faltar
}
