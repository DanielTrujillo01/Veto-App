import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  completarGoogleSchema,
  vincularGoogleSchema,
  type MotivoErrorGoogle,
  type ResultadoGoogle,
} from '@veto/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from './auth.guard';
import { cookieGoogle, cookieReautenticacion, cookieSesion, leerCookie } from './cookies';
import { GoogleOAuthClient } from './google-oauth.cliente';
import {
  COOKIE_GOOGLE_ESTADO,
  COOKIE_GOOGLE_PENDIENTE,
  GoogleAuthService,
  VIGENCIA_GOOGLE_S,
  VIGENCIA_REAUTENTICACION_S,
} from './google-auth.service';

const DURACION_SESION_S = 604800;

/** Parámetros con los que Google devuelve a la persona. Cualquier otra forma se descarta. */
const retornoSchema = z.object({
  code: z.string().max(2048).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(200).optional(),
});

@ApiTags('identidad')
@Controller('identidad/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly google: GoogleAuthService,
    private readonly cliente: GoogleOAuthClient,
  ) {}

  @Get('disponible')
  @ApiOperation({ summary: 'Indica si el inicio de sesión con Google está configurado (HU-003)' })
  disponible() {
    return { disponible: this.cliente.disponible };
  }

  @Get()
  @ApiOperation({
    summary: 'Empezar el inicio de sesión con Google (HU-003)',
    description:
      'Navegación del navegador (no fetch): redirige a Google. Al terminar, la API redirige a ' +
      '`WEB_ORIGIN/login?google=<ok|2fa|vincular|registro|error>` (con `&motivo=` si falló).',
  })
  async iniciar(@Res() response: Response) {
    if (!this.cliente.disponible) return this.volver(response, 'error', 'no_disponible');
    try {
      const { url, state } = await this.google.iniciar();
      this.sinCache(response);
      response.append('Set-Cookie', cookieGoogle(COOKIE_GOOGLE_ESTADO, state, VIGENCIA_GOOGLE_S));
      return response.redirect(HttpStatus.FOUND, url);
    } catch (fallo) {
      this.logger.error('No se pudo iniciar el flujo de Google', fallo);
      return this.volver(response, 'error', 'proveedor');
    }
  }

  @Get('estado')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Cómo confirma esta cuenta las acciones delicadas (HU-003)',
    description:
      '{ vinculada, sinContrasena }. Si sinContrasena es true, para eliminar la cuenta se usa ' +
      'GET /identidad/google/reautenticar en lugar de la contraseña.',
  })
  estado(@Req() request: RequestAutenticada) {
    return this.google.estadoDeCuenta(request.usuario.id);
  }

  @Get('reautenticar')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Volver a pasar por Google para confirmar una acción delicada (HU-003)',
    description:
      'Navegación del navegador con la sesión abierta; Google pide las credenciales de nuevo. ' +
      'Termina en `WEB_ORIGIN/login?google=reauth` (constancia de 5 minutos en la cookie ' +
      '`veto_reauth`, de un solo uso) o en `google=error&motivo=...`. Después se llama a ' +
      '`DELETE /identidad/me` con { confirmacion: "ELIMINAR" }.',
  })
  async reautenticar(@Req() request: RequestAutenticada, @Res() response: Response) {
    if (!this.cliente.disponible) return this.volver(response, 'error', 'no_disponible');
    try {
      const { url, state } = await this.google.iniciarReautenticacion(request.usuario.id);
      this.sinCache(response);
      response.append('Set-Cookie', cookieGoogle(COOKIE_GOOGLE_ESTADO, state, VIGENCIA_GOOGLE_S));
      return response.redirect(HttpStatus.FOUND, url);
    } catch (fallo) {
      if (fallo instanceof ConflictException)
        return this.volver(response, 'error', 'cuenta_distinta');
      this.logger.error('No se pudo iniciar la reautenticación con Google', fallo);
      return this.volver(response, 'error', 'proveedor');
    }
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Regreso desde Google (HU-003)',
    description:
      'Solo lo invoca Google. Cancelar, rechazar o un error del proveedor redirigen a la web ' +
      'con `google=error` y nunca abren sesión.',
  })
  async retorno(@Query() query: unknown, @Req() request: Request, @Res() response: Response) {
    this.sinCache(response);
    // El intento es de un solo uso: la cookie del navegador se descarta pase lo que pase.
    response.append('Set-Cookie', cookieGoogle(COOKIE_GOOGLE_ESTADO, '', 0));

    const parametros = retornoSchema.safeParse(query);
    if (!parametros.success) return this.volver(response, 'error', 'estado');

    try {
      const r = await this.google.procesarRetorno(
        parametros.data,
        leerCookie(request.headers.cookie, COOKIE_GOOGLE_ESTADO),
        request.headers.cookie,
      );
      switch (r.resultado) {
        case 'ok':
          response.append('Set-Cookie', cookieSesion(r.token, DURACION_SESION_S));
          return this.volver(response, 'ok');
        case '2fa':
          return this.volver(response, '2fa', undefined, r.desafio);
        case 'reauth':
          response.append('Set-Cookie', cookieReautenticacion(r.token, VIGENCIA_REAUTENTICACION_S));
          return this.volver(response, 'reauth');
        case 'vincular':
        case 'registro':
          response.append(
            'Set-Cookie',
            cookieGoogle(COOKIE_GOOGLE_PENDIENTE, r.pendiente, VIGENCIA_GOOGLE_S),
          );
          return this.volver(response, r.resultado);
        case 'error':
          return this.volver(response, 'error', r.motivo);
      }
    } catch (fallo) {
      this.logger.error('Falló el regreso desde Google', fallo);
      return this.volver(response, 'error', 'proveedor');
    }
  }

  @Get('pendiente')
  @ApiOperation({ summary: 'Qué falta para terminar el ingreso con Google (HU-003)' })
  async pendiente(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.sinCache(response);
    const token = leerCookie(request.headers.cookie, COOKIE_GOOGLE_PENDIENTE);
    return { pendiente: await this.google.consultarPendiente(token) };
  }

  @Post('vincular')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vincular Google a la cuenta existente con ese correo (HU-003)',
    description:
      'Body { contrasena, codigo? }. Demuestra que la cuenta es suya; el código de Google ' +
      'Authenticator es obligatorio si tiene 2FA. Cinco fallos invalidan la solicitud.',
  })
  async vincular(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const datos = validar(vincularGoogleSchema, body);
    const sesion = await this.google.vincular(
      leerCookie(request.headers.cookie, COOKIE_GOOGLE_PENDIENTE),
      datos,
    );
    return this.abrirSesion(response, sesion);
  }

  @Post('completar')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear la cuenta de quien entra por primera vez con Google (HU-003)',
    description: 'Body { celular }. El nombre y el correo vienen de Google.',
  })
  async completar(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const datos = validar(completarGoogleSchema, body);
    const sesion = await this.google.completarRegistro(
      leerCookie(request.headers.cookie, COOKIE_GOOGLE_PENDIENTE),
      datos,
    );
    return this.abrirSesion(response, sesion);
  }

  @Delete('pendiente')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descartar la solicitud pendiente de Google (HU-003)' })
  async descartar(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.google.cancelarPendiente(
      leerCookie(request.headers.cookie, COOKIE_GOOGLE_PENDIENTE),
    );
    response.append('Set-Cookie', cookieGoogle(COOKIE_GOOGLE_PENDIENTE, '', 0));
  }

  private abrirSesion(
    response: Response,
    sesion: {
      token: string;
      usuario: { id: string; nombre: string; celular: string; correo: string; rol: string };
    },
  ) {
    response.append('Set-Cookie', cookieSesion(sesion.token, DURACION_SESION_S));
    response.append('Set-Cookie', cookieGoogle(COOKIE_GOOGLE_PENDIENTE, '', 0));
    return { usuario: sesion.usuario };
  }

  private sinCache(response: Response) {
    response.setHeader('Cache-Control', 'no-store');
  }

  /** Devuelve a la persona a la web; el destino es siempre el origen configurado. */
  private volver(
    response: Response,
    resultado: ResultadoGoogle,
    motivo?: MotivoErrorGoogle,
    desafio?: string,
  ) {
    const destino = new URL('/login', this.cliente.urlWeb);
    destino.searchParams.set('google', resultado);
    if (motivo) destino.searchParams.set('motivo', motivo);
    // El desafío 2FA va en el fragmento: no llega a servidores ni a registros de acceso.
    if (desafio) destino.hash = `desafio=${encodeURIComponent(desafio)}`;
    return response.redirect(HttpStatus.FOUND, destino.toString());
  }
}
