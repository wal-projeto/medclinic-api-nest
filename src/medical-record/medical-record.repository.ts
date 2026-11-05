// Responsabilidade: é a "porta" do prontuário: diz o que o service pode pedir ao banco, sem dizer como o banco faz.

import { Injectable } from '@nestjs/common';
import { MedicalRecord } from './medical-record.entity';

// NewMedicalRecord = só os campos que mandamos gravar. O id e a data de criação o banco preenche
export type NewMedicalRecord = Pick<
  MedicalRecord,
  'patientId' | 'doctorId' | 'text'
>;

// PORTA
@Injectable()
export abstract class MedicalRecordRepository {
  // "grave este registro e me devolva o registro completo (com id e createdAt)"
  abstract create(data: NewMedicalRecord): Promise<MedicalRecord>;
}
