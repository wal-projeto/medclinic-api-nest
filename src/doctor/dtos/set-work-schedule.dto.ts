// Responsabilidade: descreve e valida o corpo do PUT: uma lista shifts, e
// cada turno com dia, horas e duração. Barra o formato errado antes de o service ser chamado.

import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// HH:MM de 24 horas: 00:00 a 23:59, sempre com dois dígitos ("8:00", "24:00", "12:60" e "08:00:00"  são recusados)
const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ShiftDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekDay!: number; // 0 (domingo) a 6 (sábado), 2 passa; 7, 2.5 e "2" (texto) → 400

  @Matches(HORA_HHMM, { message: 'startTime must be in the format HH:MM' })
  startTime!: string;

  @Matches(HORA_HHMM, { message: 'endTime must be in the format HH:MM' })
  endTime!: string;

  @IsInt()
  @Min(1)
  @Max(1440) // no máximo um dia inteiro. Um número gigante estouraria a coluna e viraria 500
  slotDurationMinutes!: number; // 0 e 99999999999 → 400
}

export class SetWorkScheduleDto {
  @IsArray() // [] é válido: apaga a escala
  @ValidateNested({ each: true }) // valida cada turno com as regras do ShiftDto
  @Type(() => ShiftDto) // sem isto, o pipe não transforma cada item em ShiftDto e não valida
  shifts!: ShiftDto[];
}

// Campos a mais no corpo (por exemplo doctorId ou id dentro de um turno) são descartados pelo AppValidationPipe.
