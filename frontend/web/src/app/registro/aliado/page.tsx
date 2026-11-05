'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { registroAliadoSchema } from '@veto/shared';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { erroresPorCampo } from '@/lib/errores';

type TipoAliado = 'CLINICA' | 'VET_INDEPENDIENTE' | 'TIENDA';
type RespuestaRegistro = {
  usuario: { id: string; nombre: string };
  aliado: { id: string; nombre: string; tipo: TipoAliado; estado: 'PENDIENTE' | 'ACTIVO' };
};

const opciones: { tipo: TipoAliado; nombre: string; detalle: string; icono: string }[] = [
  {
    tipo: 'CLINICA',
    nombre: 'Clínica veterinaria',
    detalle: 'Atención médica para mascotas con equipo y sedes.',
    icono: '✚',
  },
  {
    tipo: 'VET_INDEPENDIENTE',
    nombre: 'Veterinario independiente',
    detalle: 'Ofrece servicios veterinarios en sede o a domicilio.',
    icono: '✳',
  },
  {
    tipo: 'TIENDA',
    nombre: 'Tienda de productos',
    detalle: 'Alimentos, accesorios e higiene.',
    icono: '♡',
  },
];

export default function RegistroAliado() {
  const [tipo, setTipo] = useState<TipoAliado | ''>('');
  const [datos, setDatos] = useState({
    nombre: '',
    nombreAliado: '',
    celular: '',
    correo: '',
    contrasena: '',
    contacto: '',
    descripcion: '',
  });
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [registroCompletado, setRegistroCompletado] = useState(false);

  function cambiarDato(campo: keyof typeof datos, valor: string) {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
    setErrores((actuales) => {
      const nuevos = { ...actuales };
      delete nuevos[campo];
      return nuevos;
    });
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tipo) {
      setError('Selecciona el tipo de aliado para continuar.');
      return;
    }

    setError('');
    const validacion = registroAliadoSchema.safeParse({
      ...datos,
      tipo,
      nombreAliado: datos.nombreAliado || undefined,
      descripcion: datos.descripcion || undefined,
      contacto: datos.contacto || undefined,
    });
    if (!validacion.success) {
      setErrores(erroresPorCampo(validacion.error));
      setError('Revisa los campos marcados antes de continuar.');
      return;
    }

    setErrores({});
    setCargando(true);
    try {
      const resultado = await api<RespuestaRegistro>('/aliados', {
        method: 'POST',
        body: JSON.stringify(validacion.data),
      });
      if (!resultado.aliado?.id) {
        throw new Error('La API no confirmó el identificador de tu aliado. Inténtalo de nuevo.');
      }
      window.localStorage.setItem('veto-aliado-id', resultado.aliado.id);
      setRegistroCompletado(true);
    } catch (causa) {
      if (causa instanceof ApiError) {
        setErrores(causa.fieldErrors);
        setError(
          causa.status === 404
            ? 'La API conectada todavía no expone el registro de aliados (HU-007). Actualiza el backend o habilita la ruta en develop e inténtalo de nuevo.'
            : Object.keys(causa.fieldErrors).length
              ? 'Revisa los campos marcados antes de continuar.'
              : causa.message,
        );
      } else {
        setError(
          causa instanceof Error
            ? causa.message
            : 'No pudimos registrar tu aliado. Revisa que la API esté disponible e inténtalo de nuevo.',
        );
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="workspace-page workspace-page--narrow">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow eyebrow--dark">CRECE CON VETO</p>
          <h1>Registra tu aliado</h1>
          <p>Crea la cuenta de tu organización y continúa configurando su perfil.</p>
        </div>
      </div>

      <section className="workspace-card">
        <h2>¿Qué tipo de aliado eres?</h2>
        <div className="partner-type-grid">
          {opciones.map((opcion) => (
            <button
              aria-pressed={tipo === opcion.tipo}
              className={`partner-type-card${tipo === opcion.tipo ? ' is-selected' : ''}`}
              key={opcion.tipo}
              onClick={() => {
                setTipo(opcion.tipo);
                setError('');
              }}
              type="button"
            >
              <span aria-hidden="true">{opcion.icono}</span>
              <strong>{opcion.nombre}</strong>
              <small>{opcion.detalle}</small>
            </button>
          ))}
          <button
            className="partner-type-card partner-type-card--unavailable"
            disabled
            type="button"
          >
            <span aria-hidden="true">⌂</span>
            <strong>Fundación</strong>
            <small>El registro de fundaciones aún no está habilitado.</small>
          </button>
        </div>
        <AlertBox tone="warning" title="Registro de fundaciones pendiente">
          En la rama develop el backend aún no acepta fundaciones como tipo de aliado (HU-078). No
          se enviará ni guardará información.
        </AlertBox>
      </section>

      {tipo && !registroCompletado && (
        <section className="workspace-card">
          <h2>Información de tu cuenta</h2>
          <p className="workspace-card__intro">
            Estos datos crean la cuenta de tu organización. Después podrás configurar sedes,
            servicios y equipo desde tu panel.
          </p>
          {error && (
            <div className="auth-error" role="alert">
              <strong>No pudimos crear tu cuenta</strong>
              <span>{error}</span>
            </div>
          )}
          <form className="form-stack" onSubmit={enviar}>
            <label className="field">
              <span>Nombre de quien administra *</span>
              <input
                aria-invalid={Boolean(errores.nombre)}
                autoComplete="name"
                className={`control${errores.nombre ? ' control--error' : ''}`}
                maxLength={120}
                onChange={(event) => cambiarDato('nombre', event.target.value)}
                required
                value={datos.nombre}
              />
              {errores.nombre && <small className="field-error">{errores.nombre}</small>}
            </label>
            <label className="field">
              <span>Nombre de la organización *</span>
              <input
                aria-invalid={Boolean(errores.nombreAliado)}
                className={`control${errores.nombreAliado ? ' control--error' : ''}`}
                maxLength={160}
                onChange={(event) => cambiarDato('nombreAliado', event.target.value)}
                required
                value={datos.nombreAliado}
              />
              {errores.nombreAliado && (
                <small className="field-error">{errores.nombreAliado}</small>
              )}
            </label>
            <label className="field">
              <span>Celular de contacto *</span>
              <span className="phone-control">
                <span className="phone-prefix">+57</span>
                <input
                  aria-invalid={Boolean(errores.celular)}
                  autoComplete="tel-national"
                  className={`control${errores.celular ? ' control--error' : ''}`}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) =>
                    cambiarDato('celular', event.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="300 123 4567"
                  required
                  value={datos.celular}
                />
              </span>
              {errores.celular && <small className="field-error">{errores.celular}</small>}
            </label>
            <label className="field">
              <span>Correo electrónico *</span>
              <input
                aria-invalid={Boolean(errores.correo)}
                autoComplete="email"
                className={`control${errores.correo ? ' control--error' : ''}`}
                onChange={(event) => cambiarDato('correo', event.target.value)}
                required
                type="email"
                value={datos.correo}
              />
              {errores.correo && <small className="field-error">{errores.correo}</small>}
            </label>
            <label className="field">
              <span>Contraseña *</span>
              <span className="password-control">
                <input
                  aria-invalid={Boolean(errores.contrasena)}
                  autoComplete="new-password"
                  className={`control${errores.contrasena ? ' control--error' : ''}`}
                  maxLength={128}
                  minLength={8}
                  onChange={(event) => cambiarDato('contrasena', event.target.value)}
                  required
                  type={mostrarContrasena ? 'text' : 'password'}
                  value={datos.contrasena}
                />
                <button
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="password-toggle"
                  onClick={() => setMostrarContrasena(!mostrarContrasena)}
                  type="button"
                >
                  {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
              <small className="field__hint">Usa al menos 8 caracteres.</small>
              {errores.contrasena && <small className="field-error">{errores.contrasena}</small>}
            </label>
            <label className="field">
              <span>Contacto adicional (opcional)</span>
              <input
                aria-invalid={Boolean(errores.contacto)}
                className={`control${errores.contacto ? ' control--error' : ''}`}
                maxLength={160}
                onChange={(event) => cambiarDato('contacto', event.target.value)}
                value={datos.contacto}
              />
              {errores.contacto && <small className="field-error">{errores.contacto}</small>}
            </label>
            <label className="field">
              <span>Descripción (opcional)</span>
              <textarea
                aria-invalid={Boolean(errores.descripcion)}
                className={`control textarea${errores.descripcion ? ' control--error' : ''}`}
                maxLength={2000}
                onChange={(event) => cambiarDato('descripcion', event.target.value)}
                value={datos.descripcion}
              />
              <small className="character-count">{datos.descripcion.length}/2.000</small>
              {errores.descripcion && <small className="field-error">{errores.descripcion}</small>}
            </label>
            <VetoButton className="auth-submit" loading={cargando} type="submit">
              Crear cuenta de aliado
            </VetoButton>
          </form>
        </section>
      )}

      {registroCompletado && (
        <section className="workspace-card">
          <AlertBox tone="success" title="Tu perfil de aliado está creado">
            La solicitud quedó pendiente de activación por el equipo de Veto. Inicia sesión con el
            correo registrado cuando tu cuenta esté habilitada.
          </AlertBox>
          <Link className="veto-button veto-button--primary auth-submit" href="/ingresar">
            Iniciar sesión
          </Link>
        </section>
      )}

      <p className="workspace-back">
        <Link href="/ingresar">Volver a ingresar</Link>
      </p>
    </div>
  );
}
