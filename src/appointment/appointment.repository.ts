import { Injectable } from '@nestjs/common';
import { Appointment } from './appointment.entity';

// NewAppointment = só os campos que mandamos gravar. O id e as datas de criação o banco preenche
export type NewAppointment = Pick<
  Appointment,
  'doctorId' | 'patientId' | 'startsAt' | 'endsAt' | 'status'
>;

// Nenhuma consulta dura mais de 1440 minutos (um dia): quem se sobrepõe a uma consulta nova começou, no máximo, um dia antes dela
export const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// A regra de conflito que o service entrega ao repositório: recebe as consultas ativas do médico e do paciente
// que podem se sobrepor à nova e LANÇA um AppException se alguma se sobrepõe
export type AssertFree = (
  doctorAppointments: Appointment[],
  patientAppointments: Appointment[],
) => void;

// PORTA
@Injectable()
export abstract class AppointmentRepository {
  // "grave esta consulta, mas só depois de conferir os conflitos COM O MÉDICO TRAVADO": numa transação, trava a linha do médico
  // (quem chegar depois espera), busca as consultas ativas do médico e do paciente que COMEÇAM de um dia antes do início
  // até o fim da nova, chama assertFree (que lança se há conflito) e só então grava, devolvendo a consulta completa, com o id
  abstract createWithLock(
    data: NewAppointment,
    assertFree: AssertFree,
  ): Promise<Appointment>;
}
