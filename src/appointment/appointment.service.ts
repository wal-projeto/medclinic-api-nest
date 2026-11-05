import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { paginate } from '../@common/pagination/paginated';
import type { AuthUser } from '../auth/jwt.service';
import { DoctorRepository } from '../doctor/doctor.repository';
import { WorkScheduleRepository } from '../doctor/work-schedule.repository';
import { PatientRepository } from '../patient/patient.repository';
import { Appointment } from './appointment.entity';
import { AppointmentRepository } from './appointment.repository';
import {
  AppointmentRulesService,
  StatusActor,
} from './appointment-rules.service';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';
import { ListAppointmentsQueryDto } from './dtos/list-appointments-query.dto';
import { UpdateAppointmentStatusDto } from './dtos/update-appointment-status.dto';

@Injectable()
export class AppointmentService {
  constructor(
    private readonly doctorRepository: DoctorRepository, // para conferir se o médico existe
    private readonly patientRepository: PatientRepository, // para conferir se o paciente existe
    private readonly workScheduleRepository: WorkScheduleRepository, // para ler os turnos do médico
    private readonly appointmentRepository: AppointmentRepository,
    private readonly rules: AppointmentRulesService, // as regras de horário
  ) {}

  // MARCA UMA CONSULTA
  async create(input: CreateAppointmentDto) {
    const startsAt = new Date(input.startsAt); // "2026-10-13T08:00:00-03:00" → o instante 11:00 UTC

    // 1) o médico e o paciente existem (404)
    if (!(await this.doctorRepository.findById(input.doctorId))) {
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado');
    }
    if (!(await this.patientRepository.findById(input.patientId))) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'Paciente não encontrado',
      );
    }

    // 2, 3 e 4) o horário cai num turno, na grade e cabe no turno (422). Devolve o fim da consulta
    const shifts = await this.workScheduleRepository.findByDoctorId(
      input.doctorId,
    );
    const endsAt = this.rules.resolveEndsAt(shifts, startsAt);
    const period = { startsAt, endsAt };

    // 5 e 6) a transação com a linha do médico travada: o repositório trava, busca as consultas ativas do médico e do paciente
    // e chama esta regra, que lança o 409 se alguma se sobrepõe; só se passar, ele grava. O médico vem antes do paciente
    const saved = await this.appointmentRepository.createWithLock(
      {
        doctorId: input.doctorId,
        patientId: input.patientId,
        startsAt,
        endsAt,
        status: 'scheduled', // toda consulta nasce agendada
      },
      (doctorAppointments, patientAppointments) => {
        if (this.rules.hasOverlap(doctorAppointments, period)) {
          throw new AppException(
            'HORARIO_INDISPONIVEL',
            'O médico já tem uma consulta nesse horário',
          );
        }
        if (this.rules.hasOverlap(patientAppointments, period)) {
          throw new AppException(
            'PACIENTE_INDISPONIVEL',
            'O paciente já tem uma consulta nesse horário',
          );
        }
      },
    );
    return this.toResponse(saved);
  }

  // LISTA AS CONSULTAS COM FILTROS E PAGINAÇÃO. Quem é só médico (sem admin) enxerga apenas as consultas dele, não importa o que mande na URL
  async list(query: ListAppointmentsQueryDto, user: AuthUser) {
    // 1) o período (from e to opcionais, dias inteiros no relógio de São Paulo). 400 se from é depois de to
    const { from, to } = this.rules.resolveListPeriod(query.from, query.to);

    // 2) o filtro forçado por perfil: o doctor só vê as consultas do próprio registro de médico
    let doctorId = query.doctorId;
    if (this.isOnlyDoctor(user)) {
      const own = await this.doctorRepository.findByUserId(user.id);
      // usuário doctor sem registro de médico, ou pedindo o médico de outro: lista vazia (e a busca nem acontece)
      if (!own || (query.doctorId !== undefined && query.doctorId !== own.id)) {
        return paginate([], 0, query.page, query.pageSize);
      }
      doctorId = own.id;
    }

    // 3) a página pedida (page e pageSize viram skip e take) com os filtros que vieram
    const { appointments, total } = await this.appointmentRepository.findPage({
      doctorId,
      patientId: query.patientId,
      status: query.status,
      from,
      to,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return paginate(
      appointments.map((appointment) => this.toResponse(appointment)),
      total,
      query.page,
      query.pageSize,
    );
  }

  // CONSULTA UMA CONSULTA PELO id. Quem é só médico (sem admin) só pode ver as dele: a de outro médico dá 403
  async findById(id: number, user: AuthUser) {
    // recebe o número de quem pede
    const appointment = await this.appointmentRepository.findById(id);
    if (!appointment) {
      // 404 antes de qualquer conferência de perfil.
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'Consulta não encontrada',
      );
    }

    if (this.isOnlyDoctor(user)) {
      // só entra no id quem é só médico. ['doctor'] -> true. ['doctor','admin'], ['secretary'], ['admin'] → false.
      const own = await this.doctorRepository.findByUserId(user.id); // o médico do usuário do token.
      // own?.id é o número do médico, ou undefined se own for null; diferente do médico da consulta → 403
      if (own?.id !== appointment.doctorId) {
        //
        throw new AppException(
          'ACESSO_NEGADO',
          'O médico só pode ver as próprias consultas',
        );
      }
    }

    return this.toResponse(appointment);
  }

  // TROCA O ESTADO DA CONSULTA. A ordem das respostas: 404 (não existe), 403 (o doctor que não é o médico desta consulta),
  // 422 (o ciclo de vida não permite a troca) e 403 (o perfil não pode fazer esta troca). Só então grava
  async changeStatus(
    id: number,
    input: UpdateAppointmentStatusDto,
    user: AuthUser,
  ) {
    const appointment = await this.appointmentRepository.findById(id); // a consulta, ou null
    if (!appointment) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'Consulta não encontrada',
      );
    }

    // quem é este usuário em relação a ESTA consulta: admin, secretary e/ou o médico dela
    const actors = await this.resolveActors(user, appointment);

    // o doctor (sem admin) que não é o médico desta consulta nunca mexe nela, e também não descobre em que estado ela está
    if (this.isOnlyDoctor(user) && !actors.includes('appointmentDoctor')) {
      throw new AppException(
        'ACESSO_NEGADO',
        'O médico só pode alterar as próprias consultas',
      );
    }

    // a lista de papéis que podem fazer a troca, ou null = a troca não existe (inclusive ficar no mesmo estado)
    const allowed = this.rules.actorsForTransition(
      appointment.status,
      input.status,
    );
    if (!allowed) {
      throw new AppException(
        'TRANSICAO_INVALIDA',
        `A consulta está ${appointment.status} e não pode passar para ${input.status}`,
      );
    }

    // a autoridade: o usuário é um dos que podem fazer esta troca? secretary × ['appointmentDoctor', 'admin'] → false → 403
    if (!allowed.some((actor) => actors.includes(actor))) {
      throw new AppException(
        'ACESSO_NEGADO',
        'Seu perfil não pode fazer esta troca de estado',
      );
    }

    // grava só se a consulta ainda estiver no estado lido; se outra requisição chegou antes, a troca deixou de ser válida
    const changed = await this.appointmentRepository.updateStatus(
      id,
      appointment.status,
      input.status,
    );
    if (!changed) {
      throw new AppException(
        'TRANSICAO_INVALIDA',
        'A consulta mudou de estado enquanto a troca era feita',
      );
    }

    return { ...this.toResponse(appointment), status: input.status }; // os seis campos, com o estado novo
  }

  // O que este usuário é em relação a esta consulta: admin, secretary e/ou appointmentDoctor se é doctor e o registro dele é o doctorId da consulta
  private async resolveActors(
    user: AuthUser,
    appointment: Appointment,
  ): Promise<StatusActor[]> {
    const actors: StatusActor[] = [];
    if (user.roles.includes('admin')) actors.push('admin');
    if (user.roles.includes('secretary')) actors.push('secretary');
    if (user.roles.includes('doctor')) {
      // só consulta o médico quando o usuário tem o perfil doctor (o admin e a secretária não gastam essa consulta ao banco)
      const own = await this.doctorRepository.findByUserId(user.id);
      if (own?.id === appointment.doctorId) actors.push('appointmentDoctor');
    }
    return actors;
  }

  // "É só médico": tem o perfil doctor e não tem o admin (quem acumula os dois é tratado como admin)
  private isOnlyDoctor(user: AuthUser): boolean {
    return user.roles.includes('doctor') && !user.roles.includes('admin');
  }

  // O contrato: só os seis campos (sem doctor, patient, createdAt e updatedAt). As datas saem em UTC (ISO) no JSON
  private toResponse(appointment: Appointment) {
    return {
      id: appointment.id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
    };
  }
}
