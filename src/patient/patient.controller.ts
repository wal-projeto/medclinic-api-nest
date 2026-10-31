import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { RequireRole } from '../auth/decorator/require-role.decorator';
import { CreatePatientDto } from './dtos/create-patient.dto';
import { ListPatientsQueryDto } from './dtos/list-patients-query.dto';
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

  @Get() // GET /api/v1/patients : Sem @RequireRole: o guard só exige um token válido, então qualquer perfil passa.
  list(@Query() query: ListPatientsQueryDto) {
    // @Query() entrega a query string validada como ListPatientsQueryDto
    return this.patientService.list(query);
  }

  @Get(':id') // GET /api/v1/patients/:id . Sem @RequireRole: pega o :id e passa pelo pipe : "2" -> 2 ; "abc"-> 400
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.patientService.findById(id);
  }
}
