'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PerfilUsuario } from '@veto/shared';
import { actualizarPerfilSchema, eliminarCuentaSchema } from '@veto/shared';
import { AlertBox, Avatar, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { erroresPorCampo } from '@/lib/errores';

type PerfilForm = { nombre: string; celular: string; correo: string; contrasenaActual: string };
type Estado2fa = { activado: boolean; activadoEn: string | null };
type Configuracion2fa = { activado: false; secreto: string; uri: string };

export default function MiPerfil() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [formulario, setFormulario] = useState<PerfilForm>({
    nombre: '',
    celular: '',
    correo: '',
    contrasenaActual: '',
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [exito, setExito] = useState('');
  const [tab, setTab] = useState<'datos' | 'seguridad'>('datos');
  const [estado2fa, setEstado2fa] = useState<Estado2fa | null>(null);
  const [cargando2fa, setCargando2fa] = useState(false);
  const [error2fa, setError2fa] = useState('');
  const [configuracion2fa, setConfiguracion2fa] = useState<Configuracion2fa | null>(null);
  const [codigo2fa, setCodigo2fa] = useState('');
  const [activando2fa, setActivando2fa] = useState(false);
  const [eliminarAbierto, setEliminarAbierto] = useState(false);
  const [contrasenaEliminar, setContrasenaEliminar] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [eliminada, setEliminada] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const resultado = await api<{ usuario: PerfilUsuario }>('/identidad/me');
      setPerfil(resultado.usuario);
      setFormulario({
        nombre: resultado.usuario.nombre,
        celular: resultado.usuario.celular,
        correo: resultado.usuario.correo,
        contrasenaActual: '',
      });
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos consultar tu perfil. Verifica tu sesión e inténtalo de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cargarEstado2fa() {
    setCargando2fa(true);
    setError2fa('');
    try {
      const resultado = await api<Estado2fa>('/identidad/2fa');
      setEstado2fa(resultado);
    } catch (causa) {
      setError2fa(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos consultar la verificación en dos pasos.',
      );
    } finally {
      setCargando2fa(false);
    }
  }

  async function iniciarActivacion2fa() {
    setCargando2fa(true);
    setError2fa('');
    try {
      const resultado = await api<Configuracion2fa>('/identidad/2fa/activar', {
        method: 'POST',
      });
      setConfiguracion2fa(resultado);
      setCodigo2fa('');
    } catch (causa) {
      setError2fa(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos preparar la verificación en dos pasos.',
      );
    } finally {
      setCargando2fa(false);
    }
  }

  async function confirmarActivacion2fa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivando2fa(true);
    setError2fa('');
    try {
      const resultado = await api<Estado2fa>('/identidad/2fa/activar/confirmar', {
        method: 'POST',
        body: JSON.stringify({ codigo: codigo2fa }),
      });
      setEstado2fa(resultado);
      setConfiguracion2fa(null);
      setCodigo2fa('');
      setExito('La verificación en dos pasos quedó activada.');
    } catch (causa) {
      setError2fa(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos validar el código. Revisa tu aplicación e inténtalo de nuevo.',
      );
    } finally {
      setActivando2fa(false);
    }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setExito('');
    const cambios: Record<string, string> = {};
    if (perfil && formulario.nombre.trim() !== perfil.nombre) cambios.nombre = formulario.nombre;
    if (perfil && formulario.celular !== perfil.celular) cambios.celular = formulario.celular;
    if (perfil && formulario.correo.trim() !== perfil.correo) cambios.correo = formulario.correo;
    if (cambios.correo) cambios.contrasenaActual = formulario.contrasenaActual;
    const validacion = actualizarPerfilSchema.safeParse(cambios);
    if (!validacion.success) {
      setErrores(erroresPorCampo(validacion.error));
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      const respuesta = await api<{ usuario: PerfilUsuario }>('/identidad/me', {
        method: 'PATCH',
        body: JSON.stringify(validacion.data),
      });
      setPerfil(respuesta.usuario);
      setFormulario({
        nombre: respuesta.usuario.nombre,
        celular: respuesta.usuario.celular,
        correo: respuesta.usuario.correo,
        contrasenaActual: '',
      });
      setExito('Tus datos quedaron actualizados.');
    } catch (causa) {
      if (causa instanceof ApiError && Object.keys(causa.fieldErrors).length) {
        setErrores(causa.fieldErrors);
      }
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos guardar los cambios. Inténtalo de nuevo.',
      );
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCuenta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resultado = eliminarCuentaSchema.safeParse({
      contrasena: contrasenaEliminar,
      confirmacion,
    });
    if (!resultado.success) {
      setErrores(erroresPorCampo(resultado.error));
      return;
    }
    setEliminando(true);
    setError('');
    try {
      await api<{ mensaje: string }>('/identidad/me', {
        method: 'DELETE',
        body: JSON.stringify(resultado.data),
      });
      setEliminada(true);
      setEliminarAbierto(false);
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos eliminar tu cuenta. Inténtalo de nuevo.',
      );
    } finally {
      setEliminando(false);
    }
  }

  if (eliminada) {
    return (
      <div className="workspace-page">
        <div className="empty-state">
          <span className="empty-state__illustration" aria-hidden="true">
            ✓
          </span>
          <h1>Tu cuenta fue eliminada</h1>
          <p>Ya no podrás iniciar sesión con ella.</p>
          <Link className="veto-button veto-button--primary" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page workspace-page--narrow">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow eyebrow--dark">TU CUENTA VETO</p>
          <h1>Mi perfil</h1>
          <p>Administra tus datos personales y la seguridad de tu cuenta.</p>
        </div>
        {perfil && <Avatar name={perfil.nombre} />}
      </div>
      <div className="workspace-tabs" role="tablist" aria-label="Opciones de perfil">
        <button
          aria-selected={tab === 'datos'}
          className={tab === 'datos' ? 'is-active' : ''}
          onClick={() => setTab('datos')}
          role="tab"
          type="button"
        >
          Mis datos
        </button>
        <button
          aria-selected={tab === 'seguridad'}
          className={tab === 'seguridad' ? 'is-active' : ''}
          onClick={() => {
            setTab('seguridad');
            if (perfil && !estado2fa && !cargando2fa) void cargarEstado2fa();
          }}
          role="tab"
          type="button"
        >
          Seguridad
        </button>
      </div>

      {error && (
        <AlertBox tone="error" title="No se pudo completar la solicitud">
          {error}
        </AlertBox>
      )}
      {exito && (
        <AlertBox tone="success" title="Cambios guardados">
          {exito}
        </AlertBox>
      )}
      {cargando ? (
        <div className="workspace-card">
          <span className="skeleton pet-skeleton-line" />
          <span className="skeleton pet-skeleton-line" />
          <span className="skeleton pet-skeleton-line pet-skeleton-line--short" />
        </div>
      ) : !perfil ? (
        <div className="workspace-card">
          <p>Inicia sesión para consultar y actualizar tu perfil.</p>
          <Link className="veto-button veto-button--primary" href="/ingresar">
            Ir a iniciar sesión
          </Link>
        </div>
      ) : tab === 'datos' ? (
        <section className="workspace-card">
          <h2>Información personal</h2>
          <p className="workspace-card__intro">
            Mantén tus datos al día para gestionar tus servicios.
          </p>
          <form className="form-stack" onSubmit={guardar} noValidate>
            <label className="field">
              <span>Nombre completo</span>
              <input
                autoComplete="name"
                className="control"
                onChange={(event) => setFormulario({ ...formulario, nombre: event.target.value })}
                value={formulario.nombre}
              />
              {errores.nombre && <small className="field-error">{errores.nombre}</small>}
            </label>
            <label className="field">
              <span>Celular</span>
              <span className="phone-control">
                <span className="phone-prefix">+57</span>
                <input
                  autoComplete="tel-national"
                  className="control"
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      celular: event.target.value.replace(/\D/g, ''),
                    })
                  }
                  value={formulario.celular}
                />
              </span>
              {errores.celular && <small className="field-error">{errores.celular}</small>}
            </label>
            <label className="field">
              <span>Correo electrónico</span>
              <input
                autoComplete="email"
                className="control"
                onChange={(event) => setFormulario({ ...formulario, correo: event.target.value })}
                type="email"
                value={formulario.correo}
              />
              {perfil.correo !== formulario.correo && (
                <span className="field">
                  <span>Confirma el cambio con tu contraseña actual</span>
                  <input
                    autoComplete="current-password"
                    className="control"
                    onChange={(event) =>
                      setFormulario({ ...formulario, contrasenaActual: event.target.value })
                    }
                    type="password"
                    value={formulario.contrasenaActual}
                  />
                </span>
              )}
              {errores.correo && <small className="field-error">{errores.correo}</small>}
              {errores.contrasenaActual && (
                <small className="field-error">{errores.contrasenaActual}</small>
              )}
            </label>
            <div className="form-actions form-actions--left">
              <VetoButton loading={guardando} type="submit">
                Guardar cambios
              </VetoButton>
            </div>
          </form>
        </section>
      ) : (
        <div className="form-stack">
          <section className="workspace-card">
            <div className="workspace-card__title-row">
              <div>
                <h2>Verificación en dos pasos</h2>
                <p className="workspace-card__intro">
                  Usa una aplicación autenticadora para pedir un código adicional al iniciar sesión.
                </p>
              </div>
              {estado2fa && (
                <span
                  className={`status-badge ${estado2fa.activado ? 'status-badge--success' : 'status-badge--neutral'}`}
                >
                  {estado2fa.activado ? 'Activada' : 'Desactivada'}
                </span>
              )}
            </div>
            {error2fa && (
              <AlertBox tone="error" title="No se pudo completar la solicitud">
                {error2fa}
              </AlertBox>
            )}
            {cargando2fa && !estado2fa ? (
              <div aria-label="Consultando seguridad" className="workspace-card">
                <span className="skeleton pet-skeleton-line" />
              </div>
            ) : estado2fa?.activado ? (
              <AlertBox tone="success" title="Tu cuenta tiene una protección adicional">
                En cada inicio de sesión te pediremos el código vigente de tu aplicación
                autenticadora.
              </AlertBox>
            ) : configuracion2fa ? (
              <div className="form-stack">
                <AlertBox tone="info" title="Agrega Veto a tu aplicación autenticadora">
                  Configura una cuenta de tipo TOTP con el correo de tu cuenta y esta clave. Usa
                  códigos de seis dígitos que cambian cada 30 segundos.
                </AlertBox>
                <label className="field">
                  <span>Clave de configuración</span>
                  <input className="control" readOnly value={configuracion2fa.secreto} />
                </label>
                <form className="form-stack" onSubmit={confirmarActivacion2fa}>
                  <label className="field">
                    <span>Código de tu aplicación</span>
                    <input
                      autoComplete="one-time-code"
                      className="control code-input"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) =>
                        setCodigo2fa(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      pattern="[0-9]{6}"
                      required
                      value={codigo2fa}
                    />
                  </label>
                  <VetoButton
                    disabled={codigo2fa.length !== 6}
                    loading={activando2fa}
                    type="submit"
                  >
                    Confirmar y activar
                  </VetoButton>
                </form>
              </div>
            ) : (
              <div className="form-stack">
                <p className="workspace-card__intro">
                  Al activarla, necesitarás una aplicación compatible con Google Authenticator para
                  acceder a tu cuenta.
                </p>
                <div className="form-actions form-actions--left">
                  <VetoButton
                    disabled={cargando2fa}
                    loading={cargando2fa}
                    onClick={() => void iniciarActivacion2fa()}
                    type="button"
                  >
                    Configurar verificación en dos pasos
                  </VetoButton>
                  {error2fa && (
                    <button
                      className="text-action"
                      onClick={() => void cargarEstado2fa()}
                      type="button"
                    >
                      Reintentar consulta
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
          <section className="danger-zone">
            <p className="eyebrow eyebrow--dark">ZONA DE PELIGRO</p>
            <h2>Eliminar mi cuenta</h2>
            <p>
              Se anonimizarán tus datos personales, se cancelarán tus citas futuras y se conservará
              el historial clínico de tus mascotas según la ley.
            </p>
            <VetoButton onClick={() => setEliminarAbierto(true)} variant="danger">
              Eliminar cuenta
            </VetoButton>
          </section>
        </div>
      )}
      <p className="workspace-back">
        <Link href="/">Volver al inicio</Link>
      </p>

      {eliminarAbierto && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="delete-title"
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            role="dialog"
          >
            <h2 id="delete-title">¿Quieres eliminar tu cuenta?</h2>
            <p>
              Esta acción no se puede deshacer. Necesitamos confirmar tu contraseña y tu decisión.
            </p>
            <form className="form-stack" onSubmit={eliminarCuenta}>
              <label className="field">
                <span>Contraseña actual</span>
                <input
                  autoComplete="current-password"
                  className="control"
                  onChange={(event) => setContrasenaEliminar(event.target.value)}
                  required
                  type="password"
                  value={contrasenaEliminar}
                />
              </label>
              <label className="field">
                <span>Escribe ELIMINAR para confirmar</span>
                <input
                  className="control"
                  onChange={(event) => setConfirmacion(event.target.value)}
                  required
                  value={confirmacion}
                />
                {errores.confirmacion && (
                  <small className="field-error">{errores.confirmacion}</small>
                )}
              </label>
              <div className="form-actions">
                <VetoButton
                  onClick={() => {
                    setEliminarAbierto(false);
                    setErrores({});
                  }}
                  variant="secondary"
                >
                  Cancelar
                </VetoButton>
                <VetoButton
                  disabled={confirmacion !== 'ELIMINAR' || !contrasenaEliminar}
                  loading={eliminando}
                  type="submit"
                  variant="danger"
                >
                  Eliminar definitivamente
                </VetoButton>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
