// Responsabilidade: descreve e valida o que vem na URL da agenda do médico: o primeiro e o último dia do período (from e to).
// Barra o formato errado antes de o service ser chamado. As regras "from antes de to" e "no máximo 31 dias" ficam no service.

import { IsISO8601, Matches } from 'class-validator';

// Só dia, mês e ano, com zeros: "2026-10-05" passa; "2026-10-5", "05/10/2026" e "2026-10-05T00:00:00Z" não
export const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export class CalendarQueryDto {
  @Matches(SO_DATA, { message: 'from must be in the format YYYY-MM-DD' })
  @IsISO8601({ strict: true }) // data que existe de verdade: "2026-02-30" → 400
  from!: string; // primeiro dia do período (o dia inteiro conta)

  @Matches(SO_DATA, { message: 'to must be in the format YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  to!: string; // último dia do período (o dia inteiro conta)
}
