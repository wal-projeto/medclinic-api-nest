import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { CreatePatientDto } from './dtos/create-patient.dto';
import { Patient } from './patient.entity';
import { PatientRepository } from './patient.repository';

@Injectable()
export class PatientService {
  constructor(private readonly patientRepository: PatientRepository) {}

  async create(input: CreatePatientDto) {
    if (await this.patientRepository.existsByCpf(input.cpf)) {
      // CPF já existe?
      throw new AppException('CPF_JA_CADASTRADO', 'CPF já cadastrado.');
    }

    const patient = await this.patientRepository.create({
      // Grava só name e cpf
      name: input.name,
      cpf: input.cpf,
    });

    return this.toResponse(patient); // Devolve o formato do contrato
  }

  private toResponse(patient: Patient) {
    // Monta a resposta com os 4 campos { id: , name: , cpf: , createAt: Date } updateAt e deleteAt ficam de fora
    return {
      id: patient.id,
      name: patient.name,
      cpf: patient.cpf,
      createdAt: patient.createdAt, // sai como Date. Quando o Nest converte para JSON, ele vira "2026-10-29T14:39:39.762Z", em UTC e com Z.
    };
  }
}
