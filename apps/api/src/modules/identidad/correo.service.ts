import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type Env } from '../../config/env';

@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private readonly transporte?: Transporter;
  private verificadoHasta = 0;
  private verificacionPendiente?: Promise<boolean>;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.SMTP_URL) this.transporte = createTransport(env.SMTP_URL);
  }

  get disponible(): boolean {
    return Boolean(this.transporte && this.env.SMTP_FROM);
  }

  async verificarConexion(): Promise<boolean> {
    if (!this.disponible || !this.transporte) return false;
    if (Date.now() < this.verificadoHasta) return true;
    if (this.verificacionPendiente) return this.verificacionPendiente;

    this.verificacionPendiente = this.transporte
      .verify()
      .then(() => {
        this.verificadoHasta = Date.now() + 60_000;
        return true;
      })
      .catch((error: unknown) => {
        const codigo =
          typeof error === 'object' && error !== null && 'code' in error
            ? String(error.code)
            : 'sin código';
        this.logger.error(`No se pudo verificar el servidor SMTP (${codigo})`);
        return false;
      })
      .finally(() => {
        this.verificacionPendiente = undefined;
      });

    return this.verificacionPendiente;
  }

  async enviarCodigoRecuperacion(correo: string, nombre: string, codigo: string): Promise<void> {
    if (!this.disponible || !this.transporte || !this.env.SMTP_FROM) {
      throw new ServiceUnavailableException(
        'El envío de correos de recuperación todavía no está configurado.',
      );
    }

    await this.transporte.sendMail({
      from: this.env.SMTP_FROM,
      to: correo,
      subject: 'Tu código para restablecer la contraseña de Veto',
      text: [
        `Hola${nombre ? ` ${nombre}` : ''},`,
        '',
        `Tu código de recuperación es: ${codigo}`,
        '',
        'El código vence en 10 minutos y solo se puede usar una vez.',
        'Si no solicitaste este cambio, puedes ignorar este correo.',
        '',
        'Equipo Veto',
      ].join('\n'),
    });
  }
}
