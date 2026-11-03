//Responsabilidade: guarda as regras da escala: cada turno começa antes de terminar, turnos do mesmo dia não se sobrepõem.
// aqui: "o médico precisa existir"
// Monta a resposta do contrato. Não sabe nada de banco nem de HTTP.

import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { DoctorRepository } from './doctor.repository';
import { SetWorkScheduleDto } from './dtos/set-work-schedule.dto';
import { WorkScheduleRepository } from './work-schedule.repository';
import { WorkShift } from './work-shift.entity';

@Injectable()
export class WorkScheduleService {
  constructor(
    private readonly doctorRepository: DoctorRepository, // para conferir se o médico existe
    private readonly workScheduleRepository: WorkScheduleRepository,
  ) {}

  // SUBSTITUI A ESCALA INTEIRA DO MÉDICO
  async replace(doctorId: number, input: SetWorkScheduleDto) {
    this.validateShifts(input.shifts); // regras que o formato sozinho não pega; lança 400 antes de ir ao banco

    // pergunta à porta do médico se ele existe. null → 404
    if (!(await this.doctorRepository.findById(doctorId))) {
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado');
    }

    const saved = await this.workScheduleRepository.replaceForDoctor(
      // manda a porta trocar a escala
      doctorId,
      input.shifts,
    );
    // devolve cada turno só com os 4 campos do contrato (sem id e sem doctorId)
    return { shifts: saved.map((shift) => this.toResponse(shift)) };
  }

  // CONSULTA A ESCALA DO MÉDICO. Médico sem escala é 200 com { shifts: [] }; médico que não existe é 404
  async findByDoctorId(doctorId: number) {
    if (!(await this.doctorRepository.findById(doctorId))) {
      // pergunta à porta do médico se ele existe. null → 404
      throw new AppException('RECURSO_NAO_ENCONTRADO', 'Médico não encontrado');
    }

    const shifts = await this.workScheduleRepository.findByDoctorId(doctorId); // pergunta à "porta da escala" quantos turnos esse médico tem.
    return { shifts: shifts.map((shift) => this.toResponse(shift)) }; // passa cada turno pelo toResponse. Médico sem escala é 200 com { shifts: [] }; médico que não existe é 404(AppException)
  }

  // Duas regras: cada turno começa antes de terminar, e dois turnos do mesmo dia não se sobrepõem
  private validateShifts(shifts: SetWorkScheduleDto['shifts']) {
    for (const shift of shifts) {
      // início maior ou igual ao fim é 400. A comparação como texto vale porque o DTO garante HH:MM.
      if (shift.startTime >= shift.endTime) {
        // 12:00 >= 12:00 → true. 14:00 >= 12:00 → true. 08:00 >= 12:00 → false
        throw new AppException(
          'DADOS_INVALIDOS',
          'startTime must be before endTime',
        );
      }
    }

    // Ordena por dia e hora de início (cópia, sem mexer na ordem enviada) e compara cada turno com o anterior
    const ordered = [...shifts].sort(
      (a, b) => a.weekDay - b.weekDay || (a.startTime < b.startTime ? -1 : 1),
    );
    for (let i = 1; i < ordered.length; i++) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      // começar ANTES de o anterior terminar é sobreposição; começar EXATAMENTE quando termina (encostado) é válido
      if (
        current.weekDay === previous.weekDay && // ordena pelo dia; se o dia for igual, pela hora de início
        current.startTime < previous.endTime //(mesmo dia) 08-15 e 14-18: "14:00" < "15:00" → 400. 08-12 e 12-18: "12:00" < "12:00" é falso → passa
      ) {
        throw new AppException(
          'DADOS_INVALIDOS',
          'shifts on the same weekDay must not overlap',
        );
      }
    }
  }

  // O contrato quer "08:00". Cortar em 5 letras serve também para a hora lida do banco, que vem como "08:00:00"
  private toResponse(shift: WorkShift) {
    return {
      weekDay: shift.weekDay,
      startTime: shift.startTime.slice(0, 5), // "08:00:00" → "08:00"
      endTime: shift.endTime.slice(0, 5),
      slotDurationMinutes: shift.slotDurationMinutes,
    };
  }
}
// Basta por comparar cada turno com o anterior, porque a lista está ordenada por dia e hora de início. Se houver sobreposição, o turno atual começa antes de o anterior terminar. Começar exatamente quando termina (encostado) é válido.
