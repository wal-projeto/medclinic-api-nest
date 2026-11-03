//Responsabilidade: descreve e valida o corpo do POST: o médico, o paciente e o início da consulta (com fuso).
// Barra o formato errado antes de o service ser chamado. O fim não vem do cliente.

import { IsInt, IsISO8601, Matches } from 'class-validator';

// Termina em "Z" ou em um deslocamento como "-03:00" ("2026-10-13T08:00:00" sem fuso é recusado)
const COM_FUSO = /(Z|[+-]\d{2}:\d{2})$/;

export class CreateAppointmentDto {
  @IsInt()
  doctorId!: number; // 3 passa; "3" (texto) e 3.5 → 400

  @IsInt()
  patientId!: number;

  @IsISO8601({ strict: true, strictSeparator: true }) // data e hora de verdade: "2026-02-30T08:00:00-03:00" e "2026-10-13 08:00" → 400
  @Matches(COM_FUSO, { message: 'startsAt must include a time zone offset' })
  startsAt!: string; // "2026-10-13T08:00:00-03:00" é o mesmo instante que "2026-10-13T11:00:00.000Z"
}

// Campos a mais no corpo (por exemplo endsAt, status ou id) são descartados pelo AppValidationPipe.
