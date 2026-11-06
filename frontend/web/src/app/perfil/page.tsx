'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { PerfilUsuario } from '@veto/shared';
import { actualizarPerfilSchema, eliminarCuentaSchema } from '@veto/shared';
import { AlertBox, Avatar, VetoButton } from '@/components/ui/veto-components';
import { API_URL, api, ApiError } from '@/lib/api';
import { erroresPorCampo } from '@/lib/errores';
import { notificarCambioSesion } from '@/lib/session';

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
  const [clave2faCopiada, setClave2faCopiada] = useState(false);
  const [activando2fa, setActivando2fa] = useState(false);
  const [eliminarAbierto, setEliminarAbierto] = useState(false);
  const [contrasenaEliminar, setContrasenaEliminar] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [consultandoCuentaGoogle, setConsultandoCuentaGoogle] = useState(false);
  const [eliminarRequiereGoogle, setEliminarRequiereGoogle] = useState(false);
  const [eliminarReautenticada, setEliminarReautenticada] = useState(false);
  const [reautenticandoGoogle, setReautenticandoGoogle] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [eliminada, setEliminada] = useState(false);
  const ventanaReautenticacion = useRef<Window | null>(null);
  const temporizadorReautenticacion = useRef<number | null>(null);

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

  useEffect(
    () => () => {
      if (temporizadorReautenticacion.current !== null) {
        window.clearInterval(temporizadorReautenticacion.current);
      }
      ventanaReautenticacion.current?.close();
    },
    [],
  );

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
      setClave2faCopiada(false);
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

  async function copiarClave2fa() {
    if (!configuracion2fa) return;
    setError2fa('');
    try {
      await navigator.clipboard.writeText(configuracion2fa.secreto);
      setClave2faCopiada(true);
    } catch {
      setError2fa('No pudimos copiar la clave. Puedes seleccionarla y copiarla manualmente.');
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

  async function prepararEliminacionCuenta() {
    setError('');
    setErrores({});
    setContrasenaEliminar('');
    setConfirmacion('');
    setEliminarReautenticada(false);
    setEliminarRequiereGoogle(false);
    setConsultandoCuentaGoogle(true);
    try {
      const estado = await api<{ vinculada: boolean; sinContrasena: boolean }>(
        '/identidad/google/estado',
      );
      setEliminarRequiereGoogle(estado.sinContrasena);
      setEliminarAbierto(true);
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos consultar cómo confirmar tu identidad. Inténtalo de nuevo.',
      );
    } finally {
      setConsultandoCuentaGoogle(false);
    }
  }

  async function enviarEliminacionCuenta(reautenticadaGoogle: boolean) {
    const datos =
      eliminarRequiereGoogle && reautenticadaGoogle
        ? { confirmacion }
        : { contrasena: contrasenaEliminar, confirmacion };
    const resultado = eliminarCuentaSchema.safeParse(datos);
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
      notificarCambioSesion(null);
      setEliminada(true);
      setEliminarAbierto(false);
    } catch (causa) {
      if (causa instanceof ApiError && causa.status === 401 && eliminarRequiereGoogle) {
        setEliminarReautenticada(false);
        setError(
          'La confirmación de Google venció. Confirma tu identidad otra vez para continuar.',
        );
      } else {
        if (causa instanceof ApiError && Object.keys(causa.fieldErrors).length) {
          setErrores(causa.fieldErrors);
        }
        setError(
          causa instanceof ApiError && causa.status === 403
            ? 'Las cuentas de aliados y veterinarios se eliminan con el Equipo Veto. Contáctanos.'
            : causa instanceof ApiError
              ? causa.message
              : 'No pudimos eliminar tu cuenta. Inténtalo de nuevo.',
        );
      }
    } finally {
      setEliminando(false);
    }
  }

  function cancelarReautenticacionGoogle() {
    if (temporizadorReautenticacion.current !== null) {
      window.clearInterval(temporizadorReautenticacion.current);
      temporizadorReautenticacion.current = null;
    }
    ventanaReautenticacion.current?.close();
    ventanaReautenticacion.current = null;
    setReautenticandoGoogle(false);
  }

  function iniciarReautenticacionGoogle() {
    const ventana = window.open(
      `${API_URL}/identidad/google/reautenticar`,
      'veto-google-reauth',
      'popup,width=520,height=680',
    );
    if (!ventana) {
      setError(
        'Tu navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo otra vez.',
      );
      return;
    }
    setError('');
    setReautenticandoGoogle(true);
    ventanaReautenticacion.current = ventana;
    temporizadorReautenticacion.current = window.setInterval(() => {
      if (!ventana.closed) return;
      cancelarReautenticacionGoogle();
      setEliminarReautenticada(true);
      void enviarEliminacionCuenta(true);
    }, 400);
  }

  async function eliminarCuenta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (eliminarRequiereGoogle && !eliminarReautenticada) {
      iniciarReautenticacionGoogle();
      return;
    }
    await enviarEliminacionCuenta(eliminarReautenticada);
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
                  Escanea el código QR con tu aplicación autenticadora. Si no puedes escanearlo,
                  configura una cuenta TOTP con el correo de tu cuenta y la clave manual. Los
                  códigos de seis dígitos cambian cada 30 segundos.
                </AlertBox>
                <div className="totp-setup">
                  <div className="totp-setup__manual">
                    <label className="field">
                      <span>Clave de configuración</span>
                      <input
                        autoComplete="off"
                        className="control totp-secret"
                        readOnly
                        spellCheck={false}
                        value={configuracion2fa.secreto}
                      />
                    </label>
                    <button
                      className="text-action"
                      onClick={() => void copiarClave2fa()}
                      type="button"
                    >
                      {clave2faCopiada ? 'Clave copiada' : 'Copiar clave'}
                    </button>
                  </div>
                  <div className="totp-setup__qr">
                    <QRCodeSVG
                      aria-label="Código QR de configuración para la aplicación autenticadora"
                      bgColor="#ffffff"
                      fgColor="#1e1e1e"
                      level="M"
                      marginSize={4}
                      size={208}
                      value={configuracion2fa.uri}
                    />
                    <p>Escanéalo desde la aplicación autenticadora.</p>
                  </div>
                </div>
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
          {perfil.rol === 'TUTOR' ? (
            <section className="danger-zone">
              <p className="eyebrow eyebrow--dark">ZONA DE PELIGRO</p>
              <h2>Eliminar mi cuenta</h2>
              <p>
                Se anonimizarán tus datos personales, se cancelarán tus citas futuras y se
                conservará el historial clínico de tus mascotas según la ley.
              </p>
              <VetoButton
                loading={consultandoCuentaGoogle}
                onClick={() => void prepararEliminacionCuenta()}
                variant="danger"
              >
                Eliminar cuenta
              </VetoButton>
            </section>
          ) : (
            <AlertBox tone="info" title="Eliminación de cuenta administrada por Veto">
              Las cuentas de aliados y veterinarios no se pueden eliminar desde el perfil. Para
              solicitar la eliminación, contacta al Equipo Veto.
            </AlertBox>
          )}
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
              Esta acción no se puede deshacer.{' '}
              {eliminarRequiereGoogle
                ? reautenticandoGoogle
                  ? 'Completa la verificación en la ventana de Google y ciérrala para continuar.'
                  : 'Confirmaremos tu identidad con Google antes de completar la eliminación.'
                : 'Necesitamos confirmar tu contraseña y tu decisión.'}
            </p>
            <form className="form-stack" onSubmit={eliminarCuenta}>
              {!eliminarRequiereGoogle && (
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
                  {errores.contrasena && (
                    <small className="field-error">{errores.contrasena}</small>
                  )}
                </label>
              )}
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
                    cancelarReautenticacionGoogle();
                    setEliminarAbierto(false);
                    setErrores({});
                  }}
                  variant="secondary"
                >
                  Cancelar
                </VetoButton>
                <VetoButton
                  disabled={
                    confirmacion !== 'ELIMINAR' ||
                    (!eliminarRequiereGoogle && !contrasenaEliminar) ||
                    reautenticandoGoogle
                  }
                  loading={eliminando || reautenticandoGoogle}
                  type="submit"
                  variant="danger"
                >
                  {reautenticandoGoogle
                    ? 'Esperando a Google…'
                    : eliminarRequiereGoogle && !eliminarReautenticada
                      ? 'Continuar con Google'
                      : 'Eliminar definitivamente'}
                </VetoButton>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
