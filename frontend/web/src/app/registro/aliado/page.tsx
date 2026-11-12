'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { registroAliadoSchema, registroFundacionSchema } from '@veto/shared';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { erroresPorCampo } from '@/lib/errores';

type TipoAliado = 'CLINICA' | 'VET_INDEPENDIENTE' | 'TIENDA' | 'FUNDACION';
type PerfilRegistrado = {
  id: string;
  nombre: string;
  tipo: TipoAliado;
  estado: 'PENDIENTE' | 'ACTIVO';
};
type RespuestaRegistro = {
  usuario: { id: string; nombre: string };
  aliado?: PerfilRegistrado;
  fundacion?: PerfilRegistrado;
};

function formatearCelular(valor: string) {
  const digitos = valor.replace(/\D/g, '').slice(0, 10);
  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)} ${digitos.slice(3)}`;
  return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
}

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
  {
    tipo: 'FUNDACION',
    nombre: 'Fundación',
    detalle: 'Rescate, rehabilitación y adopción responsable.',
    icono: '⌂',
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
    ciudad: '',
    ubicacion: '',
    anioFundacion: '',
    logoUrl: '',
  });
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [registroCompletado, setRegistroCompletado] = useState(false);
  const [estadoRegistro, setEstadoRegistro] = useState<'PENDIENTE' | 'ACTIVO'>('ACTIVO');

  function cambiarDato(campo: keyof typeof datos, valor: string) {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
    setErrores((actuales) => {
      const nuevos = { ...actuales };
      delete nuevos[campo];
      return nuevos;
    });
  }

  function erroresVisibles(erroresApi: Record<string, string>, tipoFormulario: TipoAliado) {
    if (tipoFormulario !== 'FUNDACION') return erroresApi;
    const { nombre, representante, ...resto } = erroresApi;
    return {
      ...resto,
      ...(nombre ? { nombreAliado: nombre } : {}),
      ...(representante ? { nombre: representante } : {}),
    };
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tipo) {
      setError('Selecciona el tipo de aliado para continuar.');
      return;
    }

    setError('');
    const esFundacion = tipo === 'FUNDACION';
    const entrada = esFundacion
      ? {
          nombre: datos.nombreAliado,
          representante: datos.nombre,
          celular: datos.celular,
          correo: datos.correo,
          contrasena: datos.contrasena,
          descripcion: datos.descripcion,
          contacto: datos.contacto,
          ciudad: datos.ciudad,
          ubicacion: datos.ubicacion,
          anioFundacion: datos.anioFundacion,
          logoUrl: datos.logoUrl,
        }
      : {
          nombre: datos.nombre,
          celular: datos.celular,
          correo: datos.correo,
          contrasena: datos.contrasena,
          tipo,
          nombreAliado: datos.nombreAliado || undefined,
          descripcion: datos.descripcion || undefined,
          contacto: datos.contacto || undefined,
          ciudad: datos.ciudad || undefined,
          ubicacion: datos.ubicacion || undefined,
        };
    const validacion = esFundacion
      ? registroFundacionSchema.safeParse(entrada)
      : registroAliadoSchema.safeParse(entrada);
    if (!validacion.success) {
      setErrores(erroresVisibles(erroresPorCampo(validacion.error), tipo));
      setError('Revisa los campos marcados antes de continuar.');
      return;
    }

    setErrores({});
    setCargando(true);
    try {
      const resultado = await api<RespuestaRegistro>(
        esFundacion ? '/aliados/fundaciones' : '/aliados',
        {
          method: 'POST',
          body: JSON.stringify(validacion.data),
        },
      );
      const perfil = esFundacion ? resultado.fundacion : resultado.aliado;
      if (!perfil?.id) {
        throw new Error('La API no confirmó el perfil de tu aliado.');
      }
      setEstadoRegistro(perfil.estado);
      setRegistroCompletado(true);
    } catch (causa) {
      if (causa instanceof ApiError) {
        setErrores(erroresVisibles(causa.fieldErrors, tipo));
        setError(
          causa.status === 404
            ? `La API conectada todavía no expone el registro de ${esFundacion ? 'fundaciones (HU-078)' : 'aliados (HU-007)'}. Actualiza el backend e inténtalo de nuevo.`
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
          <p>
            Crea una cuenta según el tipo de aliado y completa la información que le corresponde.
          </p>
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
                setErrores({});
              }}
              type="button"
            >
              <span aria-hidden="true">{opcion.icono}</span>
              <strong>{opcion.nombre}</strong>
              <small>{opcion.detalle}</small>
            </button>
          ))}
        </div>
      </section>

      {tipo && !registroCompletado && (
        <section className="workspace-card">
          <h2>
            {tipo === 'FUNDACION' ? 'Información de la fundación' : 'Información de tu cuenta'}
          </h2>
          <p className="workspace-card__intro">
            {tipo === 'FUNDACION'
              ? 'Registra la información de tu fundación y de su representante. La solicitud quedará pendiente de activación por Veto.'
              : tipo === 'VET_INDEPENDIENTE'
                ? 'Crea tu cuenta profesional. Después podrás configurar tus servicios, disponibilidad y especies atendidas.'
                : 'Estos datos crean la cuenta de tu organización. Después podrás configurar el perfil desde tu panel.'}
          </p>
          {error && (
            <div className="auth-error" role="alert">
              <strong>No pudimos crear tu cuenta</strong>
              <span>{error}</span>
            </div>
          )}
          <form className="form-stack" onSubmit={enviar}>
            <label className="field">
              <span>
                {tipo === 'FUNDACION'
                  ? 'Nombre del representante *'
                  : 'Nombre de quien administra *'}
              </span>
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
              <span>
                {tipo === 'FUNDACION'
                  ? 'Nombre de la fundación *'
                  : tipo === 'VET_INDEPENDIENTE'
                    ? 'Nombre visible del perfil (opcional)'
                    : tipo === 'TIENDA'
                      ? 'Nombre de la tienda *'
                      : 'Nombre de la clínica *'}
              </span>
              <input
                aria-invalid={Boolean(errores.nombreAliado)}
                className={`control${errores.nombreAliado ? ' control--error' : ''}`}
                maxLength={160}
                onChange={(event) => cambiarDato('nombreAliado', event.target.value)}
                required={tipo !== 'VET_INDEPENDIENTE'}
                value={datos.nombreAliado}
              />
              {errores.nombreAliado && (
                <small className="field-error">{errores.nombreAliado}</small>
              )}
            </label>
            <label className="field">
              <span>Celular de contacto *</span>
              <span className={`phone-control${errores.celular ? ' phone-control--error' : ''}`}>
                <span className="phone-prefix">+57</span>
                <input
                  aria-invalid={Boolean(errores.celular)}
                  aria-describedby="aliado-celular-hint"
                  autoComplete="tel-national"
                  className={`control${errores.celular ? ' control--error' : ''}`}
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(event) =>
                    cambiarDato('celular', event.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  placeholder="300 123 4567"
                  required
                  value={formatearCelular(datos.celular)}
                />
              </span>
              <small className="field__hint" id="aliado-celular-hint">
                Ingresa los 10 dígitos de tu celular ({datos.celular.length}/10).
              </small>
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
              <span>
                {tipo === 'FUNDACION' ? 'Correo de contacto *' : 'Contacto adicional (opcional)'}
              </span>
              <input
                aria-invalid={Boolean(errores.contacto)}
                className={`control${errores.contacto ? ' control--error' : ''}`}
                maxLength={160}
                onChange={(event) => cambiarDato('contacto', event.target.value)}
                required={tipo === 'FUNDACION'}
                type={tipo === 'FUNDACION' ? 'email' : 'text'}
                value={datos.contacto}
              />
              {errores.contacto && <small className="field-error">{errores.contacto}</small>}
            </label>
            {(tipo === 'FUNDACION' ||
              tipo === 'CLINICA' ||
              tipo === 'TIENDA' ||
              tipo === 'VET_INDEPENDIENTE') && (
              <>
                <label className="field">
                  <span>Ciudad {tipo === 'VET_INDEPENDIENTE' ? '(opcional)' : '*'}</span>
                  <input
                    aria-invalid={Boolean(errores.ciudad)}
                    className={`control${errores.ciudad ? ' control--error' : ''}`}
                    maxLength={120}
                    onChange={(event) => cambiarDato('ciudad', event.target.value)}
                    required={tipo !== 'VET_INDEPENDIENTE'}
                    value={datos.ciudad}
                  />
                  {errores.ciudad && <small className="field-error">{errores.ciudad}</small>}
                </label>
                <label className="field">
                  <span>Ubicación {tipo === 'VET_INDEPENDIENTE' ? '(opcional)' : '*'}</span>
                  <input
                    aria-invalid={Boolean(errores.ubicacion)}
                    className={`control${errores.ubicacion ? ' control--error' : ''}`}
                    maxLength={250}
                    onChange={(event) => cambiarDato('ubicacion', event.target.value)}
                    required={tipo !== 'VET_INDEPENDIENTE'}
                    value={datos.ubicacion}
                  />
                  {errores.ubicacion && <small className="field-error">{errores.ubicacion}</small>}
                </label>
              </>
            )}
            {tipo === 'FUNDACION' && (
              <>
                <label className="field">
                  <span>Año de fundación *</span>
                  <input
                    aria-invalid={Boolean(errores.anioFundacion)}
                    className={`control${errores.anioFundacion ? ' control--error' : ''}`}
                    max={new Date().getFullYear()}
                    min="1900"
                    onChange={(event) => cambiarDato('anioFundacion', event.target.value)}
                    required
                    type="number"
                    value={datos.anioFundacion}
                  />
                  {errores.anioFundacion && (
                    <small className="field-error">{errores.anioFundacion}</small>
                  )}
                </label>
                <label className="field">
                  <span>Logo (URL, opcional)</span>
                  <input
                    aria-invalid={Boolean(errores.logoUrl)}
                    className={`control${errores.logoUrl ? ' control--error' : ''}`}
                    onChange={(event) => cambiarDato('logoUrl', event.target.value)}
                    type="url"
                    value={datos.logoUrl}
                  />
                  {errores.logoUrl && <small className="field-error">{errores.logoUrl}</small>}
                </label>
              </>
            )}
            <label className="field">
              <span>{tipo === 'FUNDACION' ? 'Descripción *' : 'Descripción (opcional)'}</span>
              <textarea
                aria-invalid={Boolean(errores.descripcion)}
                className={`control textarea${errores.descripcion ? ' control--error' : ''}`}
                maxLength={2000}
                onChange={(event) => cambiarDato('descripcion', event.target.value)}
                required={tipo === 'FUNDACION'}
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
          <AlertBox
            tone={estadoRegistro === 'ACTIVO' ? 'success' : 'warning'}
            title={
              estadoRegistro === 'ACTIVO'
                ? 'Tu perfil de aliado está activo'
                : 'Tu solicitud está pendiente de revisión'
            }
          >
            {estadoRegistro === 'ACTIVO'
              ? 'Ya puedes iniciar sesión con el correo y la contraseña que registraste.'
              : 'El equipo de Veto revisará la solicitud de tu fundación antes de habilitar su gestión.'}
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
