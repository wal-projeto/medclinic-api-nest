// Responsabilidade: é o "adaptador" do prontuário: cumpre a porta com o TypeORM e o PostgreSQL.

import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MedicalRecord } from './medical-record.entity';
import {
  MedicalRecordRepository,
  NewMedicalRecord,
} from './medical-record.repository';

// etiqueta que injeta o repositório do TypeORM
export const TYPEORM_MEDICAL_RECORD_REPOSITORY =
  'TYPEORM_MEDICAL_RECORD_REPOSITORY' as const;

@Injectable()
export class MedicalRecordTypeormRepository implements MedicalRecordRepository {
  constructor(
    @Inject(TYPEORM_MEDICAL_RECORD_REPOSITORY)
    private readonly repository: Repository<MedicalRecord>,
  ) {}

  // INSERT INTO medical_record (patient_id, doctor_id, text) VALUES (...) RETURNING id, created_at
  create(data: NewMedicalRecord): Promise<MedicalRecord> {
    return this.repository.save(this.repository.create(data)); // create monta o objeto, o save faz o INSERT e devolve com o id e o createdAt preenchidos pelo banco
  }
}
