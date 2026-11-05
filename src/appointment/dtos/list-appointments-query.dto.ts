// Responsabilidade: descreve e valida o que vem na URL da listagem de consultas: os filtros (médico, paciente, status e período)
// e a paginação (page e pageSize, herdados). Todos são opcionais. Barra o formato errado antes de o service ser chamado.

import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { MAX_INTEGER } from '../../@common/database/postgres-limits';
import { PaginationQueryDto } from '../../@common/pagination/pagination-query.dto';
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '../appointment.entity';
import { SO_DATA } from './calendar-query.dto';

// extends: herda page e pageSize com todas as regras e padrões. Sem filtro na URL, lista tudo (de quem pode ver)
export class ListAppointmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number) // "2" → 2; "abc" → NaN (e o @IsInt recusa)
  @IsInt()
  @Min(1)
  @Max(MAX_INTEGER) // acima do maior integer do banco, o PostgreSQL daria erro 500: aqui vira 400
  doctorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INTEGER)
  patientId?: number;

  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES) // só os quatro estados: scheduled, in_progress, done, cancelled
  status?: AppointmentStatus;

  @IsOptional()
  @Matches(SO_DATA, { message: 'from must be in the format YYYY-MM-DD' })
  @IsISO8601({ strict: true }) // data que existe de verdade: "2026-02-30" → 400
  from?: string; // primeiro dia do período (o dia inteiro conta)

  @IsOptional()
  @Matches(SO_DATA, { message: 'to must be in the format YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  to?: string; // último dia do período (o dia inteiro conta)
}
