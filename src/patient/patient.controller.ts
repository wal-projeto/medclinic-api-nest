import { Body, Controller, Post } from '@nestjs/common';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import { CreatePatientDto } from './dtos/create-patient.dto';
import { PatientService } from './patient.service';

@Controller('patients') // api/v1/patients
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post() // sem caminho extra. O Nest responde 201 por padrão no POST
  @RequireRole(['admin', 'secretary']) // O guard só deixa passar estes dois perfis.["doctor"]->403
  create(@Body() body: CreatePatientDto) {
    // @Body entrega o corpo já validado pelo pipe, como CreatePatient
    return this.patientService.create(body);
  }
}
