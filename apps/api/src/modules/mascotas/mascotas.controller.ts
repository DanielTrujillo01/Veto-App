import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actualizarMascotaSchema, crearMascotaSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { MascotasService } from './mascotas.service';

@ApiTags('mascotas')
@Controller('mascotas')
export class MascotasController {
  constructor(private readonly mascotas: MascotasService) {}

  @Get('especies')
  @ApiOperation({ summary: 'Catálogo de especies para el formulario de mascota' })
  especies() {
    return this.mascotas.listarEspecies();
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('TUTOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear el perfil de una mascota del tutor autenticado (HU-008)',
    description:
      'Obligatorios: nombre, especieId, sexo. Opcionales: raza, fechaNacimiento o edadMeses, ' +
      'color, pesoKg, chip, fotos (URLs, máx. 5).',
  })
  crear(@Req() request: RequestAutenticada, @Body() body: unknown) {
    return this.mascotas.crear(request.usuario.id, validar(crearMascotaSchema, body));
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('TUTOR')
  @ApiOperation({ summary: 'Listar las mascotas del tutor autenticado' })
  listar(@Req() request: RequestAutenticada) {
    return this.mascotas.listar(request.usuario.id);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('TUTOR')
  @ApiOperation({ summary: 'Consultar el perfil de una mascota propia' })
  obtener(@Req() request: RequestAutenticada, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.mascotas.obtener(request.usuario.id, id);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('TUTOR')
  @ApiOperation({
    summary: 'Editar los datos de una mascota propia (HU-010)',
    description:
      'Reemplaza todos los campos editables con las mismas validaciones de la creación; ' +
      'un opcional omitido queda vacío y "fotos" reemplaza la lista.',
  })
  actualizar(
    @Req() request: RequestAutenticada,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.mascotas.actualizar(request.usuario.id, id, validar(actualizarMascotaSchema, body));
  }
}
