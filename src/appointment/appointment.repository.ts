import { Injectable } from '@nestjs/common';
import { Appointment, AppointmentStatus } from './appointment.entity';

// NewAppointment = só os campos que mandamos gravar. O id e as datas de criação o banco preenche
export type NewAppointment = Pick<
  Appointment,
  'doctorId' | 'patientId' | 'startsAt' | 'endsAt' | 'status'
>;

// Nenhuma consulta dura mais de 1440 minutos (um dia): quem se sobrepõe a uma consulta nova começou, no máximo, um dia antes dela
export const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// O pedido da listagem: os filtros (todos opcionais), quanto pular e quanto pegar.
// { doctorId: 2, status: 'scheduled', from: 2026-10-12T03:00Z, to: 2026-10-17T03:00Z, skip: 0, take: 20 }
export type AppointmentFilter = {
  doctorId?: number;
  patientId?: number;
  status?: AppointmentStatus;
  from?: Date; // começa em from (incluído)
  to?: Date; // até to (excluído)
  skip: number;
  take: number;
};
// A resposta: a fatia e o total (de tudo o que casa com o filtro, e não só da fatia)
export type AppointmentPage = { appointments: Appointment[]; total: number };

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

  // "as consultas ATIVAS (não canceladas) deste médico que COMEÇAM de from (incluído) até to (excluído), da mais cedo para a mais tarde"
  // (sem consultas devolve [ ] e não null nem erro). Serve à agenda do médico: o período já vem como dois instantes
  abstract findActiveByDoctorInPeriod(
    doctorId: number,
    from: Date,
    to: Date,
  ): Promise<Appointment[]>;

  // "liste as consultas (com os filtros que vierem), da mais cedo para a mais tarde, uma página de cada vez e com o total"
  // (nenhuma consulta casa: { appointments: [], total: 0 })
  abstract findPage(filter: AppointmentFilter): Promise<AppointmentPage>;

  // "me dê a consulta deste número, ou null se não houver"
  abstract findById(id: number): Promise<Appointment | null>;

  // "troque o estado desta consulta de `from` para `to`, mas SÓ se ela ainda estiver em `from`": true se trocou, false se não
  // (outra requisição já mexeu nela). A troca e a conferência acontecem num comando só
  abstract updateStatus(
    id: number,
    from: AppointmentStatus,
    to: AppointmentStatus,
  ): Promise<boolean>;
}
