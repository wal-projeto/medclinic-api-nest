// Responsabilidade: descreve e valida o corpo do PATCH do status: só o estado novo. Barra o texto fora dos quatro estados
// antes de o service ser chamado. Quem pode fazer a troca e se o ciclo permite ficam no service.

import { IsIn } from 'class-validator';
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '../appointment.entity';

export class UpdateAppointmentStatusDto {
  @IsIn(APPOINTMENT_STATUSES) // "cancelled", "in_progress" passa; "em_andamento", "DONE",1 , " ", null e ausente → 400
  status!: AppointmentStatus;
}

// Campos a mais no corpo (por exemplo doctorId ou startsAt) são descartados pelo AppValidationPipe.
