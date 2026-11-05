// Responsabilidade: é a "porta de entrada" HTTP do prontuário: recebe a requisição, diz qual perfil pode e entrega ao service. Não tem regra nenhuma.

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PaginationQueryDto } from '../@common/pagination/pagination-query.dto';
import { GetAuthUser } from '../auth/decorator/get-auth-user.decorator';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { CreateMedicalRecordDto } from './dtos/create-medical-record.dto';
import { MedicalRecordService } from './medical-record.service';

@Controller('patients') // api/v1/patients (o prontuário é um pedaço da rota do paciente: /patients/:patientId/medical-records)
export class MedicalRecordController {
  constructor(private readonly medicalRecordService: MedicalRecordService) {}

  @Post(':patientId/medical-records') // POST /api/v1/patients/:patientId/medical-records : só doctor (admin e secretary → 403). O Nest responde 201 por padrão no POST
  @RequireRole(['doctor'])
  create(
    @Param('patientId', ParseIntPipe) patientId: number, // "10" -> 10 ; "abc" -> 400
    @Body() body: CreateMedicalRecordDto, // { "text": "Paciente relata dor lombar..." }
    @GetAuthUser() user: AuthUser, // quem está escrevendo: { id: 5, roles: ['doctor'] }
  ) {
    return this.medicalRecordService.create(patientId, body, user);
  }

  @Get(':patientId/medical-records') // GET /api/v1/patients/:patientId/medical-records?page=&pageSize= : admin e doctor (secretary → 403); o service confere o vínculo do doctor
  @RequireRole(['admin', 'doctor'])
  list(
    @Param('patientId', ParseIntPipe) patientId: number, // "10" -> 10 ; "abc" -> 400
    @Query() query: PaginationQueryDto, // page e pageSize já validados pelo pipe
    @GetAuthUser() user: AuthUser, // quem está lendo: { id: 5, roles: ['doctor'] }
  ) {
    return this.medicalRecordService.list(patientId, query, user);
  }
}
