import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { ReservaService } from './reserva.service';

@ApiTags('reservas')
@Controller('reservas')
@UseGuards(AuthGuard, RolesGuard)
@Roles('TUTOR')
export class ReservaController {
  constructor(private readonly reserva: ReservaService) {}

  @Get('resumen')
  @ApiOperation({
    summary: 'Datos principales de la reserva antes de confirmar (HU-031)',
    description:
      'Devuelve la fecha y hora, el servicio, el veterinario, la mascota, el motivo, el precio ' +
      'para esa mascota y el estado en que quedará la cita (AGENDADA o PENDIENTE). `listo` es ' +
      'true solo si se puede confirmar; si no, `pendientes` dice qué falta o ya no sirve ' +
      '(horario, mascotaId). No crea nada. 404 si no hay una reserva en curso.',
  })
  resumen(@Req() request: RequestAutenticada) {
    return this.reserva.resumen(request.usuario.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Confirma la reserva y crea la cita (HU-031)',
    description:
      'Sin cuerpo: usa lo que el tutor eligió (PUT/PATCH /reservas/seleccion). Vuelve a validar ' +
      'disponibilidad y campos requeridos y responde 201 con la cita (estado según la ' +
      'configuración del aliado). Es seguro repetirla (doble clic, reintento): responde 200 con ' +
      'la misma cita y `repetida: true`. 400 si falta la mascota o la hora ya pasó; 409 con ' +
      '`razon` (OCUPADO, NO_DISPONIBLE) o `codigo` (ESPECIE_NO_ATENDIDA, DUPLICADA, YA_CONFIRMADA).',
  })
  async confirmar(
    @Req() request: RequestAutenticada,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const reserva = await this.reserva.confirmar(request.usuario.id);
    if (reserva.repetida) respuesta.status(HttpStatus.OK);
    return reserva;
  }
}

@ApiTags('reservas')
@Controller('citas')
@UseGuards(AuthGuard, RolesGuard)
@Roles('TUTOR', 'ALIADO', 'VETERINARIO')
export class CitaDetalleController {
  constructor(private readonly reserva: ReservaService) {}

  @Get(':citaId')
  @ApiOperation({
    summary: 'Detalle de una cita, con el motivo (HU-030)',
    description:
      'Lo ve el tutor de la cita, el administrador del aliado y los veterinarios activos de ese ' +
      'aliado. Para cualquier otra persona responde 404, igual que si la cita no existiera.',
  })
  obtener(
    @Req() request: RequestAutenticada,
    @Param('citaId', new ParseUUIDPipe()) citaId: string,
  ) {
    return this.reserva.detalleDeCita(request.usuario.id, citaId);
  }
}
