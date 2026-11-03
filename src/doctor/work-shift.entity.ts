// Responsabilidade: descreve a tabela work_shift (um turno de um médico: dia, hora de
// início, hora de fim e duração da consulta) e as regras que o próprio banco confere em toda gravação.

import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';

// Os três CHECK são a segunda defesa: mesmo que alguém grave direto no banco, não entra turno torto
@Entity()
@Check('"week_day" BETWEEN 0 AND 6')
@Check('"start_time" < "end_time"')
@Check('"slot_duration_minutes" BETWEEN 1 AND 1440') // duração de 1 minuto até um dia inteiro (1440)
export class WorkShift {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  // O turno pertence a um médico. Muitos turnos para um médico. Se o médico for apagado, os turnos dele vão junto
  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' }) // guarda o número do médico e tem a chave estrangeira
  doctor: Doctor;

  // A mesma coluna doctor_id, lida como número simples (serve para apagar os turnos de um médico sem carregar o Doctor)
  @Column('integer', { name: 'doctor_id' })
  doctorId: number;

  // 0 (domingo) a 6 (sábado), como o Date.getDay()
  @Column('smallint')
  weekDay: number;

  // Hora de relógio da clínica, sem data e sem fuso (tipo time do PostgreSQL). Volta do banco como "08:00:00"
  @Column('time')
  startTime: string;

  @Column('time') // só a hora do relógio, sem data e sem fuso
  endTime: string;

  @Column('integer')
  slotDurationMinutes: number; // quanto dura cada consulta do turno. Na tabela vira slot_duration_minutes
}
