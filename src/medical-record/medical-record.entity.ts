// Responsabilidade: descreve a tabela medical_record (o prontuário): cada linha é um registro de texto sobre um paciente, escrito por um médico.
// O registro nunca é alterado (só nasce), por isso a tabela não tem updated_at.

import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';

// Segunda defesa: mesmo que alguém grave direto no banco, não entra registro com texto vazio (nem só com espaços)
@Entity()
@Check('length(btrim("text")) > 0')
@Index(['patientId', 'createdAt']) // acelera "os registros deste paciente, do mais novo para o mais antigo" (a listagem do prontuário)
export class MedicalRecord {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  // Muitos registros para um paciente (e para um médico). Um paciente pode ter vários registros, cada um com o médico que o escreveu
  @ManyToOne(() => Patient, { nullable: false })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  // A mesma coluna patient_id, lida como número simples (serve para filtrar sem carregar o Patient)
  @Column('integer', { name: 'patient_id' })
  patientId: number;

  @ManyToOne(() => Doctor, { nullable: false })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column('integer', { name: 'doctor_id' })
  doctorId: number;

  // O texto do registro, sem limite de tamanho no banco (o tipo text)
  @Column('text')
  text: string;

  // Quando o registro foi escrito. O banco preenche sozinho (now())
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
