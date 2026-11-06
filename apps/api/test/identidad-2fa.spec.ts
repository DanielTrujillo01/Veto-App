import { hashContrasena, generarCodigoTotp } from '../src/modules/identidad/seguridad';
import { IdentidadService } from '../src/modules/identidad/identidad.service';

const USUARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Ana Tutor',
  celular: '3001112233',
  correo: 'ana@mail.com',
  rol: 'TUTOR',
};
const SECRETO = 'JBSWY3DPEHPK3PXP';

describe('HU-005 · Google Authenticator', () => {
  it('activa 2FA con un código válido y expone el estado guardado', async () => {
    let secreto: string | null = null;
    let activadoEn: Date | null = null;
    const db = {
      query: jest.fn(async (sql: string, valores: unknown[] = []) => {
        if (sql.includes('SELECT correo, totp_secreto')) {
          return {
            rows: [{ correo: USUARIO.correo, totp_secreto: secreto, totp_activado_en: activadoEn }],
          };
        }
        if (sql.includes('SELECT totp_activado_en'))
          return { rows: [{ totp_activado_en: activadoEn }] };
        if (sql.includes('UPDATE usuario SET totp_secreto')) {
          secreto = valores[1] as string;
          return { rows: [] };
        }
        if (sql.includes('UPDATE usuario SET totp_activado_en')) {
          activadoEn = new Date();
          return { rows: [{ totp_activado_en: activadoEn }] };
        }
        throw new Error(`Consulta no esperada: ${sql}`);
      }),
    };
    const service = new IdentidadService(db as never);
    const inicio = await service.iniciarActivacion2fa(USUARIO.id);

    expect(inicio).toMatchObject({ activado: false });
    expect(inicio.secreto).toMatch(/^[A-Z2-7]{32}$/);
    expect(inicio.uri).toContain('otpauth://totp/');

    await expect(service.confirmarActivacion2fa(USUARIO.id, '000000')).rejects.toThrow(
      'inválido o ha vencido',
    );

    secreto = SECRETO;
    const activacion = await service.confirmarActivacion2fa(USUARIO.id, generarCodigoTotp(SECRETO));
    expect(activacion.activado).toBe(true);
    expect((await service.estado2fa(USUARIO.id)).activado).toBe(true);
  });

  it('exige el código TOTP en login y no crea sesión con código inválido', async () => {
    const passwordHash = await hashContrasena('clave-segura-1');
    let sesiones = 0;
    const db = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM usuario') && sql.includes('password_hash')) {
          return {
            rows: [
              {
                ...USUARIO,
                password_hash: passwordHash,
                totp_secreto: SECRETO,
                totp_activado_en: new Date(),
              },
            ],
          };
        }
        if (sql.includes('INSERT INTO desafio_2fa')) return { rows: [] };
        if (sql.includes('FROM desafio_2fa')) {
          return { rows: [{ ...USUARIO, totp_secreto: SECRETO }] };
        }
        if (sql.includes('DELETE FROM desafio_2fa')) return { rows: [] };
        if (sql.includes('INSERT INTO sesion')) {
          sesiones += 1;
          return { rows: [] };
        }
        throw new Error(`Consulta no esperada: ${sql}`);
      }),
    };
    const service = new IdentidadService(db as never);
    const login = await service.iniciarSesion(USUARIO.correo, 'clave-segura-1');

    expect(login).toMatchObject({ requiere2fa: true });
    if (!login || !('desafio' in login)) throw new Error('No se generó el desafío 2FA');
    await expect(service.completarLogin2fa(login.desafio, '000000')).rejects.toThrow(
      'inválido o ha vencido',
    );
    expect(sesiones).toBe(0);

    const acceso = await service.completarLogin2fa(login.desafio, generarCodigoTotp(SECRETO));
    expect(acceso.usuario).toEqual(USUARIO);
    expect(sesiones).toBe(1);
  });
});
