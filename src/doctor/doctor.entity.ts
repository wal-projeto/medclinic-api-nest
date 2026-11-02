import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity()
export class Doctor {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column('varchar', { length: 20, unique: true })
  crm: string;

  // Cada médico é exatamente um usuário: a tabela doctor ganha a coluna user_id, que aponta para o user e não se repete
  @OneToOne(() => User, { nullable: false })
  @JoinColumn() // o @JoinColumn() a cria sozinho a coluna user_id ) na tabela doctor, com chave estrangeira para user.id
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
