// Responsabilidade: é a "porta" do prontuário: diz o que o service pode pedir ao banco, sem dizer como o banco faz.

import { Injectable } from '@nestjs/common';
import { MedicalRecord } from './medical-record.entity';

// NewMedicalRecord = só os campos que mandamos gravar. O id e a data de criação o banco preenche
export type NewMedicalRecord = Pick<
  MedicalRecord,
  'patientId' | 'doctorId' | 'text'
>;

// O pedido da listagem: de qual paciente, quanto pular e quanto pegar: { patientId: 10, skip: 0, take: 20 }
export type MedicalRecordFilter = {
  patientId: number;
  skip: number;
  take: number;
};
// A resposta: a fatia e o total (de todos os registros do paciente, e não só da fatia)
export type MedicalRecordPage = { records: MedicalRecord[]; total: number };

// PORTA
@Injectable()
export abstract class MedicalRecordRepository {
  // "grave este registro e me devolva o registro completo (com id e createdAt)"
  abstract create(data: NewMedicalRecord): Promise<MedicalRecord>;

  // "liste os registros deste paciente, do mais novo para o mais antigo, uma página de cada vez e com o total"
  // (o paciente sem registros: { records: [], total: 0 })
  abstract findPageByPatientId(
    filter: MedicalRecordFilter,
  ): Promise<MedicalRecordPage>;
}
