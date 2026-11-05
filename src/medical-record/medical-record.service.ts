import { Injectable } from '@nestjs/common';
import { AppException } from '../@common/exceptions/app.exception';
import { paginate } from '../@common/pagination/paginated';
import { PaginationQueryDto } from '../@common/pagination/pagination-query.dto';
import { AppointmentStatus } from '../appointment/appointment.entity';
import { AppointmentRepository } from '../appointment/appointment.repository';
import type { AuthUser } from '../auth/jwt.service';
import { DoctorRepository } from '../doctor/doctor.repository';
import { PatientRepository } from '../patient/patient.repository';
import { CreateMedicalRecordDto } from './dtos/create-medical-record.dto';
import { MedicalRecord } from './medical-record.entity';
import { MedicalRecordRepository } from './medical-record.repository';

// O vínculo: o médico tem vínculo com o paciente quando existe ao menos uma consulta entre os dois em andamento ou concluída.
// Consulta só agendada (ainda não começou) ou cancelada (não houve atendimento) NÃO dá vínculo
const LINK_STATUSES: AppointmentStatus[] = ['in_progress', 'done'];

@Injectable()
export class MedicalRecordService {
  constructor(
    private readonly patientRepository: PatientRepository, // para conferir se o paciente existe
    private readonly doctorRepository: DoctorRepository, // para achar o médico do usuário do token
    private readonly appointmentRepository: AppointmentRepository, // para conferir o vínculo (a consulta entre os dois)
    private readonly medicalRecordRepository: MedicalRecordRepository,
  ) {}

  // ESCREVE NO PRONTUÁRIO. O autor é o médico do token. A ordem das respostas: 404 (o paciente não existe) e 403 (sem vínculo)
  async create(
    patientId: number,
    input: CreateMedicalRecordDto,
    user: AuthUser,
  ) {
    // 1) o paciente existe (404)
    if (!(await this.patientRepository.findById(patientId))) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'Paciente não encontrado',
      );
    }

    // 2) quem escreve é o médico do usuário do token. O usuário doctor sem registro de médico não tem vínculo com ninguém
    const doctor = await this.doctorRepository.findByUserId(user.id);

    // 3) o vínculo com este paciente: uma consulta entre os dois em andamento ou concluída (403)
    if (!doctor || !(await this.hasLink(doctor.id, patientId))) {
      throw new AppException(
        'ACESSO_NEGADO',
        'Só o médico que atendeu o paciente pode escrever no prontuário',
      );
    }

    // 4) grava. O doctorId é o do token (doctor.id), nunca um valor vindo do corpo
    const saved = await this.medicalRecordRepository.create({
      patientId,
      doctorId: doctor.id,
      text: input.text,
    });
    return this.toResponse(saved);
  }

  // LISTA O PRONTUÁRIO DO PACIENTE, do registro mais novo para o mais antigo, com paginação. Quem lê: o admin (para auditoria, sem
  // vínculo) e o médico que atendeu o paciente. A ordem das respostas: 404 (o paciente não existe) e 403 (médico sem vínculo)
  async list(patientId: number, query: PaginationQueryDto, user: AuthUser) {
    // 1) o paciente existe (404)
    if (!(await this.patientRepository.findById(patientId))) {
      throw new AppException(
        'RECURSO_NAO_ENCONTRADO',
        'Paciente não encontrado',
      );
    }

    // 2) quem é só médico (sem admin) precisa ter registro de médico e vínculo com ESTE paciente (403). O admin lê sem vínculo
    if (this.isOnlyDoctor(user)) {
      const doctor = await this.doctorRepository.findByUserId(user.id);
      if (!doctor || !(await this.hasLink(doctor.id, patientId))) {
        throw new AppException(
          'ACESSO_NEGADO',
          'Só o médico que atendeu o paciente pode ler o prontuário',
        );
      }
    }

    // 3) a página pedida (page e pageSize viram skip e take) e o total de registros do paciente
    const { records, total } =
      await this.medicalRecordRepository.findPageByPatientId({
        patientId,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });

    return paginate(
      records.map((record) => this.toResponse(record)),
      total,
      query.page,
      query.pageSize,
    );
  }

  // O vínculo do médico com o paciente: existe consulta entre os dois em andamento ou concluída? (a regra está em LINK_STATUSES)
  private hasLink(doctorId: number, patientId: number): Promise<boolean> {
    return this.appointmentRepository.existsByDoctorAndPatient(
      doctorId,
      patientId,
      LINK_STATUSES,
    );
  }

  // "É só médico": tem o perfil doctor e não tem o admin (quem acumula os dois é tratado como admin: lê sem vínculo)
  private isOnlyDoctor(user: AuthUser): boolean {
    return user.roles.includes('doctor') && !user.roles.includes('admin');
  }

  // O contrato: id, patientId, doctorId, text e createdAt (sem os objetos patient e doctor). A data sai em UTC (ISO) no JSON
  private toResponse(record: MedicalRecord) {
    return {
      id: record.id,
      patientId: record.patientId,
      doctorId: record.doctorId,
      text: record.text,
      createdAt: record.createdAt,
    };
  }
}
