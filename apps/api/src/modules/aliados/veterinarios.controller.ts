import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type CrearVeterinario } from '@veto/shared';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { VeterinariosService } from './veterinarios.service';

@ApiTags('aliados')
@Controller('aliados/:clinicaId/veterinarios')
@UseGuards(AuthGuard)
export class VeterinariosController {
  constructor(private readonly veterinarios: VeterinariosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea el perfil y la cuenta de un veterinario de una clínica' })
  crear(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Req() request: RequestAutenticada,
    @Body() entrada: CrearVeterinario,
  ) {
    return this.veterinarios.crear(request.usuario.id, clinicaId, entrada);
  }
}
