import { describe, it, expect } from 'vitest';
import { AppException } from '../@common/exceptions/app.exception';
import { Doctor } from '../doctor/doctor.entity';
import { WorkShift } from '../doctor/work-shift.entity';
import { AppointmentRulesService } from './appointment-rules.service';

// Um turno como o banco devolve: a hora com segundos ("08:00:00")
const turno = (
  weekDay: number,
  startTime: string,
  endTime: string,
  slotDurationMinutes: number,
): WorkShift => ({
  id: 1,
  doctorId: 2,
  weekDay,
  startTime: `${startTime}:00`,
  endTime: `${endTime}:00`,
  slotDurationMinutes,
  doctor: undefined as unknown as Doctor,
});

// A escala do exemplo: terça de manhã (30 min), terça à tarde (20 min) e quinta de manhã (30 min)
const escala = [
  turno(2, '08:00', '12:00', 30),
  turno(2, '14:00', '18:00', 20),
  turno(4, '08:00', '11:00', 30),
];

describe('AppointmentRulesService', () => {
  const rules = new AppointmentRulesService();
  // Roda a ação e devolve o erro que ela lançou (ou undefined, se não lançou)
  const capturar = (acao: () => unknown) => {
    try {
      acao();
    } catch (err) {
      return err as AppException;
    }
  };

  describe('resolveEndsAt', () => {
    // Terça (2026-10-13), 08:00 no horário da clínica (-03:00): cai no 1º turno, na grade, e termina 08:30
    it('devolve o início mais a duração do turno quando o horário é válido', () => {
      const endsAt = rules.resolveEndsAt(
        escala,
        new Date('2026-10-13T08:00:00-03:00'),
      );

      expect(endsAt).toEqual(new Date('2026-10-13T08:30:00-03:00'));
    });

    // A duração é a do turno em que o horário cai: terça à tarde é de 20 minutos
    it('usa a duração do turno em que o horário cai', () => {
      const endsAt = rules.resolveEndsAt(
        escala,
        new Date('2026-10-13T14:20:00-03:00'),
      );

      expect(endsAt).toEqual(new Date('2026-10-13T14:40:00-03:00'));
    });

    // O último horário da grade termina exatamente no fim do turno (17:40 + 20 = 18:00) e é válido
    it('aceita a última consulta, que termina exatamente no fim do turno', () => {
      const endsAt = rules.resolveEndsAt(
        escala,
        new Date('2026-10-13T17:40:00-03:00'),
      );

      expect(endsAt).toEqual(new Date('2026-10-13T18:00:00-03:00'));
    });

    // O dia da semana e a hora valem no relógio da clínica: terça 22:30 em São Paulo já é quarta 01:30 em UTC
    it('confere o dia e a hora no horário da clínica, e não em UTC', () => {
      const noite = [turno(2, '21:00', '23:30', 30)];

      const endsAt = rules.resolveEndsAt(
        noite,
        new Date('2026-10-13T22:30:00-03:00'),
      );

      expect(endsAt).toEqual(new Date('2026-10-13T23:00:00-03:00'));
    });

    // O mesmo instante pode chegar com outro fuso: 11:00Z é 08:00 em São Paulo
    it('aceita o horário enviado em UTC', () => {
      const endsAt = rules.resolveEndsAt(
        escala,
        new Date('2026-10-13T11:00:00Z'),
      );

      expect(endsAt).toEqual(new Date('2026-10-13T11:30:00Z'));
    });

    // Falha 1: o horário não cai em nenhum turno do dia
    it.each([
      ['dia sem turno (quarta)', '2026-10-14T08:00:00-03:00'],
      ['antes do início do turno', '2026-10-13T07:30:00-03:00'],
      ['entre dois turnos do mesmo dia', '2026-10-13T12:30:00-03:00'],
      ['exatamente no fim do turno', '2026-10-13T18:00:00-03:00'],
    ])(
      'lança HORARIO_FORA_DA_ESCALA quando o horário não cai em nenhum turno (%s)',
      (_caso, startsAt) => {
        const erro = capturar(() =>
          rules.resolveEndsAt(escala, new Date(startsAt)),
        );

        expect(erro).toBeInstanceOf(AppException);
        expect(erro?.errorCode).toBe('HORARIO_FORA_DA_ESCALA');
      },
    );

    it('lança HORARIO_FORA_DA_ESCALA quando o médico não tem escala', () => {
      expect(() =>
        rules.resolveEndsAt([], new Date('2026-10-13T08:00:00-03:00')),
      ).toThrow(AppException);
    });

    // Falha 2: está dentro do turno, mas fora da grade (múltiplos da duração a partir do início do turno)
    it.each([
      ['08:10 (30 min de duração)', '2026-10-13T08:10:00-03:00'],
      ['08:45 (30 min de duração)', '2026-10-13T08:45:00-03:00'],
      [
        '14:30 (20 min de duração, contado das 14:00)',
        '2026-10-13T14:30:00-03:00',
      ],
      ['08:00:30 (com segundos)', '2026-10-13T08:00:30-03:00'],
    ])(
      'lança HORARIO_FORA_DA_ESCALA quando o horário está fora da grade (%s)',
      (_caso, startsAt) => {
        const erro = capturar(() =>
          rules.resolveEndsAt(escala, new Date(startsAt)),
        );

        expect(erro).toBeInstanceOf(AppException);
        expect(erro?.errorCode).toBe('HORARIO_FORA_DA_ESCALA');
        expect(erro?.message).toContain('grade');
      },
    );

    // Falha 3: começa dentro do turno e na grade, mas a consulta passaria do fim (turno 08:00-11:45, consultas de 30 min)
    it('lança HORARIO_FORA_DA_ESCALA quando a consulta não cabe no fim do turno', () => {
      const curto = [turno(2, '08:00', '11:45', 30)];

      const erro = capturar(() =>
        rules.resolveEndsAt(curto, new Date('2026-10-13T11:30:00-03:00')),
      );

      expect(erro).toBeInstanceOf(AppException);
      expect(erro?.errorCode).toBe('HORARIO_FORA_DA_ESCALA');
      expect(erro?.message).toContain('não cabe');
    });
  });

  describe('hasOverlap', () => {
    // A consulta que já existe: 10:00 às 10:30
    const existente = {
      startsAt: new Date('2026-10-13T10:00:00Z'),
      endsAt: new Date('2026-10-13T10:30:00Z'),
    };
    const periodo = (inicio: string, fim: string) => ({
      startsAt: new Date(`2026-10-13T${inicio}:00Z`),
      endsAt: new Date(`2026-10-13T${fim}:00Z`),
    });

    // Os cinco cenários: um antes do outro, um depois, encostados, um dentro do outro e cruzando a borda
    it('não há sobreposição quando a nova termina antes de a existente começar', () => {
      expect(rules.hasOverlap([existente], periodo('09:00', '09:30'))).toBe(
        false,
      );
    });

    it('não há sobreposição quando a nova começa depois de a existente terminar', () => {
      expect(rules.hasOverlap([existente], periodo('11:00', '11:30'))).toBe(
        false,
      );
    });

    // Encostado não conflita: a comparação é estrita
    it('não há sobreposição quando as consultas estão encostadas (uma termina quando a outra começa)', () => {
      expect(rules.hasOverlap([existente], periodo('10:30', '11:00'))).toBe(
        false,
      );
      expect(rules.hasOverlap([existente], periodo('09:30', '10:00'))).toBe(
        false,
      );
    });

    it('há sobreposição quando a nova está dentro da existente', () => {
      expect(rules.hasOverlap([existente], periodo('10:05', '10:20'))).toBe(
        true,
      );
    });

    it('há sobreposição quando a nova contém a existente', () => {
      expect(rules.hasOverlap([existente], periodo('09:50', '10:45'))).toBe(
        true,
      );
    });

    // Cruzando a borda: os inícios são diferentes (10:20 e 10:00), e ainda assim conflita
    it('há sobreposição quando a nova cruza o fim da existente', () => {
      expect(rules.hasOverlap([existente], periodo('10:20', '10:50'))).toBe(
        true,
      );
    });

    it('há sobreposição quando a nova cruza o começo da existente', () => {
      expect(rules.hasOverlap([existente], periodo('09:45', '10:15'))).toBe(
        true,
      );
    });

    it('há sobreposição quando as duas são idênticas', () => {
      expect(rules.hasOverlap([existente], periodo('10:00', '10:30'))).toBe(
        true,
      );
    });

    it('não há sobreposição quando não há consultas', () => {
      expect(rules.hasOverlap([], periodo('10:00', '10:30'))).toBe(false);
    });

    // Basta uma da lista conflitar
    it('há sobreposição quando só uma das consultas da lista conflita', () => {
      const tarde = periodo('14:00', '14:30');

      expect(
        rules.hasOverlap([existente, tarde], periodo('14:15', '14:45')),
      ).toBe(true);
    });
  });
});
