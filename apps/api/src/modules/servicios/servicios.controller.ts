import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodError } from 'zod';
import { servicioInputSchema } from '@veto/shared';
import type { AuthenticatedRequest } from '../../auth/development-ally.guard';
import { DevelopmentAllyGuard } from '../../auth/development-ally.guard';
import { ServiciosService } from './servicios.service';

@ApiTags('servicios')
@Controller('aliados/:allyId/servicios')
@UseGuards(DevelopmentAllyGuard)
export class ServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear servicio de clínica o veterinario (HU-019)' })
  @ApiCreatedResponse({ description: 'Servicio persistido.' })
  async create(
    @Param('allyId') allyId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnAlly(allyId, req);
    try {
      return { data: await this.servicios.create(allyId, servicioInputSchema.parse(body)) };
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Datos inválidos.',
        });
      throw error;
    }
  }

  @Get(':serviceId')
  async get(
    @Param('allyId') allyId: string,
    @Param('serviceId') serviceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnAlly(allyId, req);
    return { data: await this.servicios.getForAlly(allyId, serviceId) };
  }

  private assertOwnAlly(allyId: string, req: AuthenticatedRequest): void {
    if (req.auth?.rol !== 'ALIADO' || req.auth.aliadoId !== allyId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tienes permiso para este aliado.',
      });
    }
  }
}

@ApiTags('servicios')
@Controller('servicios')
export class PublicServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  @Get(':serviceId')
  @ApiOperation({ summary: 'Consultar detalle público de un servicio disponible' })
  async get(@Param('serviceId') serviceId: string) {
    return { data: await this.servicios.getPublic(serviceId) };
  }
}
