import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { completarReservaSchema, seleccionarHorarioSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { SeleccionHorarioService } from './seleccion-horario.service';

@ApiTags('reservas')
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
      'Responde 400 { razon: "PASADO" } si la hora ya pasó y 409 { razon: "OCUPADO" | ' +
      '"NO_DISPONIBLE" } si otra cita ya lo ocupa o el aliado no atiende así. Si es válido lo ' +
      'conserva (una reserva en curso por tutor; elegir otro horario reemplaza el anterior y ' +
      'conserva la mascota y el motivo ya escritos). No reserva el espacio: eso ocurre en ' +
      'POST /reservas.',
  })
  seleccionar(@Req() request: RequestAutenticada, @Body() body: unknown) {
    return this.seleccion.seleccionar(request.usuario.id, validar(seleccionarHorarioSchema, body));
  }

  @Patch()
  @ApiOperation({
    summary: 'Indica la mascota y el motivo de la cita (HU-030, HU-031)',
    description:
      'Body con { mascotaId? , motivo? } (al menos uno; solo se cambia lo que se envía). El motivo ' +
      'es texto libre de hasta 500 caracteres: se recortan los espacios de las puntas, texto ' +
      'vacío o null lo quita, y si se pasa del límite responde 400 con errores.motivo (dice ' +
      'cuántos caracteres escribió). La mascota debe ser del tutor y de una especie que el ' +
      'aliado atienda (409 codigo ESPECIE_NO_ATENDIDA). Requiere haber elegido fecha y hora ' +
      '(404 si no) y que la reserva no esté confirmada (409 YA_CONFIRMADA). Devuelve la reserva ' +
      'en curso.',
  })
  completar(@Req() request: RequestAutenticada, @Body() body: unknown) {
    return this.seleccion.completar(request.usuario.id, validar(completarReservaSchema, body));
  }

  @Get()
  @ApiOperation({
    summary: 'Lo elegido hasta ahora, vuelto a comprobar (HU-029)',
    description:
      'Devuelve la fecha y hora, la mascota y el motivo con `vigente`. Si `vigente` es false ' +
      'trae la `razon` (PASADO, OCUPADO o NO_DISPONIBLE) y la web debe pedir elegir otro ' +
      'horario. `citaId` viene lleno cuando la reserva ya se confirmó. 404 si no hay nada o ya ' +
      'venció (`venceEn`).',
  })
  obtener(@Req() request: RequestAutenticada) {
    return this.seleccion.obtener(request.usuario.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descarta la reserva en curso (HU-029)' })
  async descartar(@Req() request: RequestAutenticada) {
    await this.seleccion.descartar(request.usuario.id);
  }
}
