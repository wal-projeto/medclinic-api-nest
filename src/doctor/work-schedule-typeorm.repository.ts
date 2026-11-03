// Responsabilidade: é quem fala com o banco pelo TypeORM: cumpre a promessa da
// porta. Troca a escala numa transação (apaga os turnos antigos e grava os
// novos, ou não faz nada).

import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  NewWorkShift,
  WorkScheduleRepository,
} from './work-schedule.repository';
import { WorkShift } from './work-shift.entity';

// etiqueta que o Nest injeta o repositório Repository<WorkShift> do TypeORM
export const TYPEORM_WORK_SHIFT_REPOSITORY =
  'TYPEORM_WORK_SHIFT_REPOSITORY' as const;

@Injectable()
export class WorkScheduleTypeormRepository implements WorkScheduleRepository {
  constructor(
    @Inject(TYPEORM_WORK_SHIFT_REPOSITORY)
    private readonly repository: Repository<WorkShift>,
  ) {}

  // Troca a escala NA MESMA TRANSAÇÃO: o banco faz BEGIN, apaga os turnos antigos, grava os novos e faz COMMIT.
  // Se a gravação falhar, o ROLLBACK devolve os turnos antigos: o médico nunca fica com a escala pela metade.
  replaceForDoctor(
    doctorId: number,
    shifts: NewWorkShift[],
  ): Promise<WorkShift[]> {
    return this.repository.manager.transaction(async (manager) => {
      await manager.delete(WorkShift, { doctorId }); // DELETE FROM work_shift WHERE doctor_id = 2. apaga só os turnos desse médico
      return manager.save(
        // grava todos de uma vez (um INSERT só) e devolve com o id de cada um. Lista vazia → não grava nada
        shifts.map(
          (shift) => manager.create(WorkShift, { ...shift, doctorId }), // monta cada turno (ainda não grava), com o número do médico junto
        ), // um INSERT para todos os turnos, na ordem enviada
      );
    });
  }
}
