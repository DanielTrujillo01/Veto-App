import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { seleccionarHorarioSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { SeleccionHorarioService } from './seleccion-horario.service';

@ApiTags('servicios')
@Controller('reservas/seleccion')
@UseGuards(AuthGuard, RolesGuard)
@Roles('TUTOR')
export class SeleccionHorarioController {
  constructor(private readonly seleccion: SeleccionHorarioService) {}

  @Put()
  @ApiOperation({
    summary: 'Elige fecha y hora en el calendario del aliado (HU-029)',
    description:
      'Body { servicioId, veterinarioId, inicio } con uno de los espacios de ' +
      'GET /aliados/:aliadoId/disponibilidad (inicio con zona horaria). El fin lo calcula la API. ' +
      'Responde 400 { motivo: "PASADO" } si la hora ya pasó y 409 { motivo: "OCUPADO" | ' +
      '"NO_DISPONIBLE" } si otra cita ya lo ocupa o el aliado no atiende así. Si es válido lo ' +
      'conserva (una selección por tutor; elegir otra reemplaza la anterior) para el resto de la ' +
      'reserva. No reserva el espacio: eso ocurre al crear la cita.',
  })
  seleccionar(@Req() request: RequestAutenticada, @Body() body: unknown) {
    return this.seleccion.seleccionar(request.usuario.id, validar(seleccionarHorarioSchema, body));
  }

  @Get()
  @ApiOperation({
    summary: 'Fecha y hora elegidas, vueltas a comprobar (HU-029)',
    description:
      'Devuelve lo elegido con `vigente`. Si `vigente` es false trae el `motivo` (PASADO, ' +
      'OCUPADO o NO_DISPONIBLE) y la web debe pedir elegir otro horario. 404 si no hay selección ' +
      'o ya venció (`venceEn`).',
  })
  obtener(@Req() request: RequestAutenticada) {
    return this.seleccion.obtener(request.usuario.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descarta la fecha y hora elegidas (HU-029)' })
  async descartar(@Req() request: RequestAutenticada) {
    await this.seleccion.descartar(request.usuario.id);
  }
}
