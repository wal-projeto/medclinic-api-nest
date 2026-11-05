import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { WorkShift } from '../doctor/work-shift.entity';
import { AppointmentStatus } from './appointment.entity';

// A hora do turno é hora de relógio da clínica; o fuso dela é o de São Paulo (a conta de "que dia da semana e que horas são" é feita nele)
const CLINIC_TIME_ZONE = 'America/Sao_Paulo';
const WEEK_DAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_CALENDAR_DAYS = 31; // o período da agenda tem no máximo 31 dias (contando o primeiro e o último)

// Quem pode fazer uma troca de estado. 'appointmentDoctor' é o médico DAQUELA consulta (e não qualquer usuário doctor)
export type StatusActor = 'admin' | 'secretary' | 'appointmentDoctor';

// O ciclo de vida: de cada estado, para quais estados se pode ir e QUEM pode fazer a troca. Estado ausente = troca proibida.
// done e cancelled são o fim da linha: ninguém sai deles
const STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  Partial<Record<AppointmentStatus, StatusActor[]>>
> = {
  scheduled: {
    in_progress: ['appointmentDoctor', 'admin'],
    cancelled: ['admin', 'secretary', 'appointmentDoctor'],
  },
  in_progress: {
    done: ['appointmentDoctor', 'admin'],
    cancelled: ['admin', 'appointmentDoctor'],
  },
  done: {},
  cancelled: {},
};

// Um período de uma consulta: o que importa para a sobreposição
export type Period = { startsAt: Date; endsAt: Date };

@Injectable()
export class AppointmentRulesService {
  // Confere as três condições do horário e devolve o FIM da consulta (início + duração do turno). 422 se alguma falhar
  resolveEndsAt(shifts: WorkShift[], startsAt: Date): Date {
    const { weekDay, minutes } = this.toClinicClock(startsAt);

    // 1) cai dentro de algum turno do dia da semana (início do turno incluído, fim excluído)
    const shift = shifts.find(
      (s) =>
        s.weekDay === weekDay &&
        this.toMinutes(s.startTime) <= minutes &&
        minutes < this.toMinutes(s.endTime),
    );
    if (!shift) {
      throw new AppException(
        'HORARIO_FORA_DA_ESCALA',
        'O horário não pertence a nenhum turno do médico',
      );
    }

    // 2) alinhado à grade: começa num múltiplo da duração, contado do início do turno (e sem segundos soltos)
    const sinceStart = minutes - this.toMinutes(shift.startTime);
    if (
      startsAt.getTime() % MINUTE_MS !== 0 ||
      sinceStart % shift.slotDurationMinutes !== 0
    ) {
      throw new AppException(
        'HORARIO_FORA_DA_ESCALA',
        'O horário não está alinhado à grade do turno',
      );
    }

    // 3) a consulta inteira cabe no turno: termina no fim dele ou antes
    if (minutes + shift.slotDurationMinutes > this.toMinutes(shift.endTime)) {
      throw new AppException(
        'HORARIO_FORA_DA_ESCALA',
        'A consulta não cabe no fim do turno',
      );
    }

    return new Date(startsAt.getTime() + shift.slotDurationMinutes * MINUTE_MS);
  }

  // O período da agenda: "2026-10-12" até "2026-10-16" são cinco DIAS INTEIROS no relógio da clínica. Devolve de qual instante (meia-noite de from)
  // até qual instante (meia-noite do dia seguinte a to, que fica de fora). 400 se from é depois de to ou se passa de 31 dias
  resolveCalendarPeriod(from: string, to: string): Period {
    const fromDay = Date.parse(`${from}T00:00:00Z`); // só para contar dias: o dia civil como instante UTC
    const toDay = Date.parse(`${to}T00:00:00Z`);

    if (fromDay > toDay) {
      throw new AppException('DADOS_INVALIDOS', 'from must not be after to');
    }
    // dias contados com as duas pontas: de 2026-10-01 a 2026-10-31 são 31 dias
    if ((toDay - fromDay) / DAY_MS + 1 > MAX_CALENDAR_DAYS) {
      throw new AppException(
        'DADOS_INVALIDOS',
        `the period must not exceed ${MAX_CALENDAR_DAYS} days`,
      );
    }

    return {
      startsAt: this.toClinicMidnight(fromDay),
      endsAt: this.toClinicMidnight(toDay + DAY_MS),
    };
  }

  // O período da listagem: from e to são opcionais e, quando vêm, valem o DIA INTEIRO no relógio da clínica (o mesmo cálculo da agenda,
  // sem o limite de 31 dias). Devolve o primeiro instante (meia-noite de from) e o instante em que acaba (meia-noite depois de to, fora).
  // O que não veio fica de fora. 400 se from é depois de to
  resolveListPeriod(from?: string, to?: string): { from?: Date; to?: Date } {
    const fromDay = from ? Date.parse(`${from}T00:00:00Z`) : undefined;
    const toDay = to ? Date.parse(`${to}T00:00:00Z`) : undefined;

    if (fromDay !== undefined && toDay !== undefined && fromDay > toDay) {
      throw new AppException('DADOS_INVALIDOS', 'from must not be after to');
    }

    return {
      from: fromDay === undefined ? undefined : this.toClinicMidnight(fromDay),
      to:
        toDay === undefined ? undefined : this.toClinicMidnight(toDay + DAY_MS),
    };
  }

  // QUEM PODE fazer a troca de `from` para `to`, ou null se o ciclo de vida não permite essa troca (inclusive ficar no mesmo estado)
  actorsForTransition(
    from: AppointmentStatus,
    to: AppointmentStatus,
  ): StatusActor[] | null {
    const actors = STATUS_TRANSITIONS[from][to];
    return actors ? [...actors] : null; // uma CÓPIA: quem receber a lista pode mexer nela sem alterar a tabela do ciclo
  }

  // Há sobreposição quando uma começa antes de a outra terminar E a outra começa antes de a primeira terminar.
  // A comparação é estrita (<): períodos encostados (10:00-10:30 e 10:30-11:00) NÃO conflitam
  hasOverlap(existing: Period[], period: Period): boolean {
    return existing.some(
      (other) =>
        period.startsAt.getTime() < other.endsAt.getTime() &&
        other.startsAt.getTime() < period.endsAt.getTime(),
    );
  }

  // Que dia da semana (0 = domingo) e quantos minutos desde a meia-noite, NO RELÓGIO DA CLÍNICA, para um instante
  private toClinicClock(instant: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)!.value;
    return {
      weekDay: WEEK_DAYS[get('weekday')],
      minutes: Number(get('hour')) * 60 + Number(get('minute')),
    };
  }

  // O instante em que um dia civil (dado como meia-noite UTC) começa NO RELÓGIO DA CLÍNICA. Em São Paulo (UTC-3), o dia 13 começa às 03:00 UTC.
  // Lê que horas são na clínica naquele instante UTC (21:00 do dia anterior) e desconta a diferença
  private toClinicMidnight(utcMidnight: number): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcMidnight));
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)!.value);
    const clinicClockAsUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    const offset = clinicClockAsUtc - utcMidnight; // -3 horas em milissegundos
    return new Date(utcMidnight - offset);
  }

  // "08:30" ou "08:30:00" (como o banco devolve) → 510
  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
  }
}
