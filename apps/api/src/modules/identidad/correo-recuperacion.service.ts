import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

type ConfiguracionCorreo = {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  user?: string;
  password?: string;
};

@Injectable()
export class CorreoRecuperacionService {
  assertConfigured(): void {
    this.configuracion();
  }

  async enviarEnlaceRecuperacion(destinatario: string, url: string): Promise<void> {
    const config = this.configuracion();
    const transporte = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: Boolean(config.user) && !config.secure,
      ...(config.user && config.password
        ? { auth: { user: config.user, pass: config.password } }
        : {}),
    });

    try {
      await transporte.sendMail({
        from: config.from,
        to: destinatario,
        subject: 'Recupera tu contraseña de Veto',
        text:
          `Recibimos una solicitud para recuperar tu contraseña de Veto.\n\n` +
          `Abre este enlace dentro de 15 minutos y confirma tu código de Google Authenticator:\n${url}\n\n` +
          'Si no solicitaste este cambio, ignora este correo. Si no activaste la verificación ' +
          'en dos pasos o perdiste acceso a tu autenticador, contacta al equipo de soporte.',
        html:
          '<p>Recibimos una solicitud para recuperar tu contraseña de Veto.</p>' +
          `<p><a href="${url}">Continuar con la recuperación</a></p>` +
          '<p>El enlace vence en 15 minutos. Después deberás confirmar un código de Google Authenticator.</p>' +
          '<p>Si no solicitaste este cambio, ignora este correo. Si no activaste la verificación ' +
          'en dos pasos o perdiste acceso a tu autenticador, contacta al equipo de soporte.</p>',
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        'No fue posible enviar el correo de recuperación. Inténtalo más tarde.',
        { cause: error },
      );
    } finally {
      transporte.close();
    }
  }

  private configuracion(): ConfiguracionCorreo {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT);
    const from = process.env.MAIL_FROM?.trim();
    const user = process.env.SMTP_USER?.trim() || undefined;
    const password = process.env.SMTP_PASSWORD || undefined;

    if (
      !host ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65_535 ||
      !from ||
      Boolean(user) !== Boolean(password)
    ) {
      throw new ServiceUnavailableException(
        'El servicio de correo de recuperación no está configurado.',
      );
    }

    return {
      host,
      port,
      secure: process.env.SMTP_SECURE?.toLowerCase() === 'true',
      from,
      user,
      password,
    };
  }
}
