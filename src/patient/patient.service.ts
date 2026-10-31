import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { paginate } from '../@common/pagination/paginated';
import { CreatePatientDto } from './dtos/create-patient.dto';
import { ListPatientsQueryDto } from './dtos/list-patients-query.dto';
import { Patient } from './patient.entity';
import { PatientRepository } from './patient.repository';

@Injectable()
export class PatientService {
  constructor(private readonly patientRepository: PatientRepository) {}

  // CREATE PACIENTE
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

  // LISTA PACIENTE COM PAGINAÇÃO
  // Recebe a query já validada e convertida em números : ?page=3&pageSize=10&name=mar
  // { page: 3, pageSize: 10, name: "mar" }
  async list(query: ListPatientsQueryDto) {
    const { patients, total } = await this.patientRepository.findPage({
      // Pede a página à porta e desmonta a resposta
      name: query.name, // repassa o nome
      skip: (query.page - 1) * query.pageSize, // A conta da paginação: páginas anteriores × tamanho : (3 − 1) × 10 = 20 → pula 20
      take: query.pageSize, // Pega o tamanho da página	10
    });

    return paginate(
      // chama a função de paginated.ts e monta  { data, meta }
      patients.map((patient) => this.toResponse(patient)),
      total,
      query.page,
      query.pageSize,
    );
  }
  // LISTA PACIENTE POR id
  async findById(id: number) {
    const patient = await this.patientRepository.findById(id); // Pergunta à porta PatientRepository : patient = Maria, ou null

    if (!patient) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'Paciente não encontrado',
      );
    }
    return this.toResponse(patient);
  }

  // Monta a resposta com os 4 campos { id: 2, name: 'Maria Souza', cpf: '98765432100', createdAt }  updateAt e deleteAt ficam de fora
  private toResponse(patient: Patient) {
    return {
      id: patient.id,
      name: patient.name,
      cpf: patient.cpf,
      createdAt: patient.createdAt, // sai como Date. Quando o Nest converte para JSON, ele vira "2026-10-29T14:39:39.762Z", em UTC e com Z.
    };
  }
}
