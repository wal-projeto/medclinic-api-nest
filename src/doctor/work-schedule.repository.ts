import { Injectable } from '@nestjs/common';
import { WorkShift } from './work-shift.entity';

// NewWorkShift = os quatro campos que o contrato traz em cada turno (o médico vem à parte)
//{ weekDay: 2, startTime: "08:00", endTime: "12:00", slotDurationMinutes: 30 }
export type NewWorkShift = Pick<
  WorkShift,
  'weekDay' | 'startTime' | 'endTime' | 'slotDurationMinutes'
>;

// PORTA
@Injectable()
export abstract class WorkScheduleRepository {
  // "troque a escala deste médico por estes turnos (a lista vazia apaga tudo) e me devolva os turnos gravados"
  // replaceForDoctor(2, [3 turnos]) → 3 turnos com id
  abstract replaceForDoctor(
    doctorId: number,
    shifts: NewWorkShift[],
  ): Promise<WorkShift[]>;
}
