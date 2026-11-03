import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';

// Os quatro estados da consulta. Nasce scheduled; os outros vêm no PATCH do status. 'scheduled' passa; 'agendada' não compila
export const APPOINTMENT_STATUSES = [
  'scheduled',
  'in_progress',
  'done',
  'cancelled',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// Segunda defesa: mesmo que alguém grave direto no banco, não entra consulta que termina antes de começar
@Entity()
@Check('"starts_at" < "ends_at"')
@Index(['doctorId', 'startsAt']) // acelera "as consultas deste médico a partir de tal instante"
@Index(['patientId', 'startsAt']) // o mesmo para o paciente
export class Appointment {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  // A consulta pertence a um médico e a um paciente. Muitas consultas para um médico (e para um paciente)
  @ManyToOne(() => Doctor, { nullable: false })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  // A mesma coluna doctor_id, lida como número simples (serve para filtrar sem carregar o Doctor)
  @Column('integer', { name: 'doctor_id' })
  doctorId: number;

  @ManyToOne(() => Patient, { nullable: false })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column('integer', { name: 'patient_id' })
  patientId: number;

  // Instantes exatos (timestamptz): o banco guarda em UTC, e o fuso da clínica só importa na hora de conferir a escala
  @Column('timestamptz')
  startsAt: Date;

  // O fim é calculado no agendamento (início + duração do turno) e fica gravado: mudar a escala depois não mexe nas consultas marcadas
  @Column('timestamptz')
  endsAt: Date;

  @Column('enum', {
    enum: APPOINTMENT_STATUSES,
    enumName: 'appointment_status',
    default: 'scheduled',
  })
  status: AppointmentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
