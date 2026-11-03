import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodError } from 'zod';
import { registroUsuarioSchema } from '@veto/shared';
import { IdentidadService } from './identidad.service';

@ApiTags('identidad')
@Controller('usuarios')
export class IdentidadController {
  constructor(private readonly identidad: IdentidadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar tutor (HU-001)' })
  @ApiCreatedResponse({ description: 'Cuenta creada; la contraseña nunca se devuelve.' })
  async register(@Body() body: unknown) {
    try {
      const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const input = registroUsuarioSchema.parse({
        ...payload,
        contrasena: payload.contrasena ?? payload.password,
      });
      return { data: await this.identidad.createTutor(input) };
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Datos inválidos.',
        });
      throw error;
    }
  }
}
