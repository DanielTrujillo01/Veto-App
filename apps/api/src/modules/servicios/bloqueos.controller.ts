import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { crearBloqueoSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { BloqueosService } from './bloqueos.service';

@ApiTags('servicios')
@Controller('aliados/:aliadoId/veterinarios/:veterinarioId/bloqueos')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ALIADO')
export class BloqueosController {
  constructor(private readonly bloqueos: BloqueosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bloquea un intervalo del calendario del veterinario (HU-022)',
    description:
      'Body { inicio, fin, motivo? } con fecha y hora y zona horaria (2026-12-24T08:00:00-05:00). ' +
      'En ese intervalo no se puede reservar. Responde 409 si se cruza con otro bloqueo o si ' +
      'hay citas vigentes (la respuesta las lista en `citas`).',
  })
  crear(
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Req() request: RequestAutenticada,
    @Body() body: unknown,
  ) {
    return this.bloqueos.crear(
      request.usuario.id,
      aliadoId,
      veterinarioId,
      validar(crearBloqueoSchema, body),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Bloqueos vigentes y futuros del veterinario (HU-022)' })
  listar(
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Req() request: RequestAutenticada,
  ) {
    return this.bloqueos.listar(request.usuario.id, aliadoId, veterinarioId);
  }

  @Delete(':bloqueoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita un bloqueo: esos espacios vuelven a estar disponibles' })
  async eliminar(
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Param('bloqueoId', new ParseUUIDPipe()) bloqueoId: string,
    @Req() request: RequestAutenticada,
  ) {
    await this.bloqueos.eliminar(request.usuario.id, aliadoId, veterinarioId, bloqueoId);
  }
}
