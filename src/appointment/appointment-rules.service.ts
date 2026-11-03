import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { WorkShift } from '../doctor/work-shift.entity';

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

  // "08:30" ou "08:30:00" (como o banco devolve) → 510
  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
  }
}
