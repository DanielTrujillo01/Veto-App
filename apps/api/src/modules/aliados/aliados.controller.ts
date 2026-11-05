import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodError } from 'zod';
import { registroAliadoSchema } from '@veto/shared';
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

  private validationError(error: unknown): never {
    if (error instanceof ZodError)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'Datos inválidos.',
      });
    throw error;
  }
}
