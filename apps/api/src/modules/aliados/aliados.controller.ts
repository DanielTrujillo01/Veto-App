import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodError } from 'zod';
import { registroAliadoSchema, sedeInputSchema } from '@veto/shared';
import type { AuthenticatedRequest } from '../../auth/development-ally.guard';
import { DevelopmentAllyGuard } from '../../auth/development-ally.guard';
import { AliadosService } from './aliados.service';

@ApiTags('aliados')
@Controller('aliados')
export class AliadosController {
  constructor(private readonly aliados: AliadosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar aliado (HU-007)' })
  @ApiCreatedResponse({ description: 'Cuenta de aliado creada.' })
  async register(@Body() body: unknown) {
    try {
      const input = body as Record<string, unknown>;
      return {
        data: await this.aliados.register(
          registroAliadoSchema.parse({ ...input, contrasena: input.contrasena ?? input.password }),
        ),
      };
    } catch (error) {
      this.validationError(error);
    }
  }

  @Post(':allyId/sedes')
  @UseGuards(DevelopmentAllyGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear sede de clínica (HU-015)' })
  async createBranch(
    @Param('allyId') allyId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnAlly(allyId, req);
    try {
      return { data: await this.aliados.createBranch(allyId, sedeInputSchema.parse(body)) };
    } catch (error) {
      this.validationError(error);
    }
  }

  @Get(':allyId/sedes')
  @UseGuards(DevelopmentAllyGuard)
  async listBranches(
    @Param('allyId') allyId: string,
    @Query('incluirInactivas') include: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnAlly(allyId, req);
    return { data: await this.aliados.listBranches(allyId, include === 'true') };
  }

  @Put(':allyId/sedes/:branchId')
  @UseGuards(DevelopmentAllyGuard)
  async updateBranch(
    @Param('allyId') allyId: string,
    @Param('branchId') branchId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnAlly(allyId, req);
    try {
      return {
        data: await this.aliados.updateBranch(allyId, branchId, sedeInputSchema.parse(body)),
      };
    } catch (error) {
      this.validationError(error);
    }
  }

  @Patch(':allyId/sedes/:branchId/desactivar')
  @UseGuards(DevelopmentAllyGuard)
  async deactivateBranch(
    @Param('allyId') allyId: string,
    @Param('branchId') branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertOwnAlly(allyId, req);
    return { data: await this.aliados.deactivateBranch(allyId, branchId) };
  }

  private assertOwnAlly(allyId: string, req: AuthenticatedRequest): void {
    if (req.auth?.rol !== 'ALIADO' || req.auth.aliadoId !== allyId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tienes permiso para este aliado.',
      });
    }
  }

  private validationError(error: unknown): never {
    if (error instanceof ZodError)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'Datos inválidos.',
      });
    throw error;
  }
}
