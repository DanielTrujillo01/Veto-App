'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Mascota } from '@veto/shared';
import { crearMascotaSchema } from '@veto/shared';
import { AlertBox, Avatar, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { erroresPorCampo } from '@/lib/errores';

type Especie = { id: number; nombre: string };
type Formulario = {
  nombre: string;
  especieId: string;
  sexo: 'MACHO' | 'HEMBRA';
  raza: string;
  edadModo: 'edad' | 'fecha';
  edadMeses: string;
  fechaNacimiento: string;
  color: string;
  pesoKg: string;
  chip: string;
  fotos: string;
};

const formularioVacio: Formulario = {
  nombre: '',
  especieId: '',
  sexo: 'MACHO',
  raza: '',
  edadModo: 'edad',
  edadMeses: '',
  fechaNacimiento: '',
  color: '',
  pesoKg: '',
  chip: '',
  fotos: '',
};

type FotoPreview = {
  original: string;
  url: string;
  estado: 'cargando' | 'lista' | 'error';
  mensaje?: string;
};

async function urlDeImagen(url: string) {
  const parsedUrl = new URL(url);
  if (['postimg.cc', 'www.postimg.cc'].includes(parsedUrl.hostname)) {
    const response = await fetch(`/api/photos/resolve?url=${encodeURIComponent(url)}`);
    const resultado = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !resultado.url) {
      throw new Error(resultado.error || 'No pudimos encontrar la imagen en Postimg.');
    }
    return resultado.url;
  }

  if (['drive.google.com', 'www.drive.google.com'].includes(parsedUrl.hostname)) {
    const id =
      parsedUrl.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? parsedUrl.searchParams.get('id');
    if (!id)
      throw new Error('Usa un enlace compartido de Google Drive que incluya el ID del archivo.');
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
  }

  return url;
}

function FotoMascota({ nombre, url }: { nombre: string; url: string }) {
  const [fallida, setFallida] = useState(false);
  const [urlDeVista, setUrlDeVista] = useState(url);

  useEffect(() => {
    let vigente = true;
    setFallida(false);
    setUrlDeVista(url);
    void urlDeImagen(url)
      .then((urlDirecta) => {
        if (vigente) setUrlDeVista(urlDirecta);
      })
      .catch(() => {
        if (vigente) setFallida(true);
      });

    return () => {
      vigente = false;
    };
  }, [url]);

  if (fallida) return <Avatar name={nombre} />;
  return (
    <img
      alt={`Foto de ${nombre}`}
      className="pet-card__photo"
      onError={() => setFallida(true)}
      src={urlDeVista}
    />
  );
}

function desdeMascota(mascota: Mascota): Formulario {
  return {
    nombre: mascota.nombre,
    especieId: String(mascota.especieId),
    sexo: mascota.sexo,
    raza: mascota.raza ?? '',
    edadModo: mascota.fechaNacimiento ? 'fecha' : 'edad',
    edadMeses: mascota.edadMeses === null ? '' : String(mascota.edadMeses),
    fechaNacimiento: mascota.fechaNacimiento ?? '',
    color: mascota.color ?? '',
    pesoKg: mascota.pesoKg === null ? '' : String(mascota.pesoKg),
    chip: mascota.chip ?? '',
    fotos: mascota.fotos.join('\n'),
  };
}

function edad(mascota: Mascota) {
  if (mascota.edadMeses !== null) {
    const anos = Math.floor(mascota.edadMeses / 12);
    const meses = mascota.edadMeses % 12;
    if (anos && meses) return `${anos} años y ${meses} meses`;
    if (anos) return `${anos} ${anos === 1 ? 'año' : 'años'}`;
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }
  if (!mascota.fechaNacimiento) return 'Edad no registrada';
  const nacimiento = new Date(`${mascota.fechaNacimiento}T00:00:00`);
  const meses = Math.max(
    0,
    (new Date().getFullYear() - nacimiento.getFullYear()) * 12 +
      new Date().getMonth() -
      nacimiento.getMonth(),
  );
  return meses >= 12 ? `${Math.floor(meses / 12)} años` : `${meses} meses`;
}

export default function MisMascotas() {
  const [mascotas, setMascotas] = useState<Mascota[]>([]);
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Mascota | null>(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');
  const [fotosPreview, setFotosPreview] = useState<FotoPreview[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [misMascotas, catalogo] = await Promise.all([
        api<Mascota[]>('/mascotas'),
        api<Especie[]>('/mascotas/especies'),
      ]);
      setMascotas(misMascotas);
      setEspecies(catalogo);
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos cargar tus mascotas. Inténtalo de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!modal) {
      setFotosPreview([]);
      return;
    }

    let vigente = true;
    const fotos = formulario.fotos
      .split(/\n|,/)
      .map((foto) => foto.trim())
      .filter(Boolean)
      .slice(0, 5);
    setFotosPreview(fotos.map((original) => ({ original, url: '', estado: 'cargando' as const })));

    void Promise.all(
      fotos.map(async (original) => {
        try {
          return { original, url: await urlDeImagen(original), estado: 'lista' as const };
        } catch (causa) {
          return {
            original,
            url: '',
            estado: 'error' as const,
            mensaje:
              causa instanceof Error
                ? causa.message
                : 'No pudimos leer este enlace. Conservamos la URL para que puedas corregirla.',
          };
        }
      }),
    ).then((previews) => {
      if (vigente) setFotosPreview(previews);
    });

    return () => {
      vigente = false;
    };
  }, [formulario.fotos, modal]);

  function abrir(mascota?: Mascota) {
    setEditando(mascota ?? null);
    setFormulario(mascota ? desdeMascota(mascota) : formularioVacio);
    setErrores({});
    setError('');
    setExito('');
    setModal(true);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = {
      nombre: formulario.nombre,
      especieId: Number(formulario.especieId),
      sexo: formulario.sexo,
      raza: formulario.raza || undefined,
      ...(formulario.edadModo === 'fecha'
        ? { fechaNacimiento: formulario.fechaNacimiento || undefined }
        : {
            edadMeses: formulario.edadMeses === '' ? undefined : Number(formulario.edadMeses),
          }),
      color: formulario.color || undefined,
      pesoKg: formulario.pesoKg === '' ? undefined : Number(formulario.pesoKg),
      chip: formulario.chip || undefined,
      fotos: formulario.fotos
        .split(/\n|,/)
        .map((foto) => foto.trim())
        .filter(Boolean),
    };
    const validacion = crearMascotaSchema.safeParse(datos);
    if (!validacion.success) {
      setErrores(erroresPorCampo(validacion.error));
      return;
    }
    setErrores({});
    setGuardando(true);
    setError('');
    try {
      const fotos = await Promise.all((validacion.data.fotos ?? []).map(urlDeImagen));
      const ruta = editando ? `/mascotas/${editando.id}` : '/mascotas';
      await api<Mascota>(ruta, {
        method: editando ? 'PUT' : 'POST',
        body: JSON.stringify({ ...validacion.data, fotos }),
      });
      setModal(false);
      setExito(
        editando ? 'Los datos de tu mascota se actualizaron.' : 'La mascota quedó registrada.',
      );
      await cargar();
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : causa instanceof Error
            ? causa.message
            : 'No pudimos guardar los cambios. Inténtalo de nuevo.',
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow eyebrow--dark">SU FAMILIA, TAMBIÉN ES LA NUESTRA</p>
          <h1>Mis mascotas</h1>
          <p>Ten a la mano su información para brindarles un cuidado más completo.</p>
        </div>
        <VetoButton onClick={() => abrir()}>＋ Agregar mascota</VetoButton>
      </div>

      {exito && (
        <AlertBox tone="success" title="Cambios guardados">
          {exito}
        </AlertBox>
      )}
      {error && !modal && (
        <AlertBox tone="error" title="No se pudo completar la solicitud">
          {error}
        </AlertBox>
      )}

      {cargando ? (
        <div className="pet-grid" aria-label="Cargando mascotas">
          {[1, 2, 3].map((item) => (
            <div className="pet-card pet-card--skeleton" key={item}>
              <span className="skeleton pet-skeleton-avatar" />
              <span className="skeleton pet-skeleton-line" />
              <span className="skeleton pet-skeleton-line pet-skeleton-line--short" />
            </div>
          ))}
        </div>
      ) : mascotas.length ? (
        <div className="pet-grid">
          {mascotas.map((mascota) => (
            <article className="pet-card" key={mascota.id}>
              <div className="pet-card__top">
                {mascota.fotos[0] ? (
                  <FotoMascota nombre={mascota.nombre} url={mascota.fotos[0]} />
                ) : (
                  <Avatar name={mascota.nombre} />
                )}
                <span className="species-chip species-chip--selected">{mascota.especie}</span>
              </div>
              <h2>{mascota.nombre}</h2>
              <p>
                {mascota.sexo === 'MACHO' ? 'Macho' : 'Hembra'} · {edad(mascota)}
              </p>
              <dl className="pet-details">
                <div>
                  <dt>Raza</dt>
                  <dd>{mascota.raza || 'Sin especificar'}</dd>
                </div>
                <div>
                  <dt>Peso</dt>
                  <dd>{mascota.pesoKg ? `${mascota.pesoKg} kg` : 'Sin registrar'}</dd>
                </div>
              </dl>
              <button className="text-action" onClick={() => abrir(mascota)} type="button">
                Editar perfil
              </button>
            </article>
          ))}
          <button className="pet-card pet-card--add" onClick={() => abrir()} type="button">
            <span aria-hidden="true">＋</span>
            <strong>Agregar otra mascota</strong>
            <small>Porque cada integrante merece su espacio.</small>
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-state__illustration" aria-hidden="true">
            ♡
          </span>
          <h2>Aún no tienes mascotas registradas</h2>
          <p>Crea su perfil para tener todos sus datos organizados en un solo lugar.</p>
          <VetoButton onClick={() => abrir()}>Registrar mi primera mascota</VetoButton>
        </div>
      )}

      <p className="workspace-back">
        <Link href="/">Volver al inicio</Link>
      </p>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(false);
          }}
          role="presentation"
        >
          <section
            aria-labelledby="pet-form-title"
            aria-modal="true"
            className="workspace-modal"
            role="dialog"
          >
            <div className="workspace-modal__heading">
              <div>
                <p className="eyebrow eyebrow--dark">PERFIL DE MASCOTA</p>
                <h2 id="pet-form-title">
                  {editando ? `Editar a ${editando.nombre}` : 'Registra a tu mascota'}
                </h2>
              </div>
              <button
                aria-label="Cerrar formulario"
                className="icon-button"
                onClick={() => setModal(false)}
                type="button"
              >
                ×
              </button>
            </div>
            {error && (
              <div className="auth-error" role="alert">
                <strong>No pudimos guardar</strong>
                <span>{error}</span>
              </div>
            )}
            <form className="form-stack" onSubmit={guardar} noValidate>
              <div className="form-two-col">
                <label className="field">
                  <span>Nombre *</span>
                  <input
                    className="control"
                    onChange={(event) =>
                      setFormulario({ ...formulario, nombre: event.target.value })
                    }
                    value={formulario.nombre}
                  />
                  {errores.nombre && <small className="field-error">{errores.nombre}</small>}
                </label>
                <label className="field">
                  <span>Especie *</span>
                  <select
                    className="control"
                    onChange={(event) =>
                      setFormulario({ ...formulario, especieId: event.target.value })
                    }
                    value={formulario.especieId}
                  >
                    <option value="">Selecciona una especie</option>
                    {especies.map((especie) => (
                      <option key={especie.id} value={especie.id}>
                        {especie.nombre}
                      </option>
                    ))}
                  </select>
                  {errores.especieId && <small className="field-error">{errores.especieId}</small>}
                </label>
              </div>
              <fieldset className="field">
                <legend>Sexo *</legend>
                <div className="choice-row">
                  {(['MACHO', 'HEMBRA'] as const).map((sexo) => (
                    <label
                      className={`choice-card${formulario.sexo === sexo ? ' is-selected' : ''}`}
                      key={sexo}
                    >
                      <input
                        checked={formulario.sexo === sexo}
                        name="sexo"
                        onChange={() => setFormulario({ ...formulario, sexo })}
                        type="radio"
                      />
                      {sexo === 'MACHO' ? '♂ Macho' : '♀ Hembra'}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="form-two-col">
                <label className="field">
                  <span>Raza (opcional)</span>
                  <input
                    className="control"
                    onChange={(event) => setFormulario({ ...formulario, raza: event.target.value })}
                    value={formulario.raza}
                  />
                </label>
                <label className="field">
                  <span>Color (opcional)</span>
                  <input
                    className="control"
                    onChange={(event) =>
                      setFormulario({ ...formulario, color: event.target.value })
                    }
                    value={formulario.color}
                  />
                </label>
              </div>
              <fieldset className="field">
                <legend>¿Cómo quieres indicar su edad?</legend>
                <div className="choice-row choice-row--compact">
                  <label
                    className={`choice-card${formulario.edadModo === 'edad' ? ' is-selected' : ''}`}
                  >
                    <input
                      checked={formulario.edadModo === 'edad'}
                      name="edadModo"
                      onChange={() => setFormulario({ ...formulario, edadModo: 'edad' })}
                      type="radio"
                    />
                    Edad en meses
                  </label>
                  <label
                    className={`choice-card${formulario.edadModo === 'fecha' ? ' is-selected' : ''}`}
                  >
                    <input
                      checked={formulario.edadModo === 'fecha'}
                      name="edadModo"
                      onChange={() => setFormulario({ ...formulario, edadModo: 'fecha' })}
                      type="radio"
                    />
                    Fecha de nacimiento
                  </label>
                </div>
                {formulario.edadModo === 'edad' ? (
                  <input
                    aria-label="Edad en meses"
                    className="control"
                    min="0"
                    onChange={(event) =>
                      setFormulario({ ...formulario, edadMeses: event.target.value })
                    }
                    placeholder="Edad en meses"
                    type="number"
                    value={formulario.edadMeses}
                  />
                ) : (
                  <input
                    aria-label="Fecha de nacimiento"
                    className="control"
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) =>
                      setFormulario({ ...formulario, fechaNacimiento: event.target.value })
                    }
                    type="date"
                    value={formulario.fechaNacimiento}
                  />
                )}
                {errores.fechaNacimiento && (
                  <small className="field-error">{errores.fechaNacimiento}</small>
                )}
                {errores.edadMeses && <small className="field-error">{errores.edadMeses}</small>}
              </fieldset>
              <div className="form-two-col">
                <label className="field">
                  <span>Peso en kg (opcional)</span>
                  <input
                    className="control"
                    min="0.01"
                    onChange={(event) =>
                      setFormulario({ ...formulario, pesoKg: event.target.value })
                    }
                    step="0.01"
                    type="number"
                    value={formulario.pesoKg}
                  />
                  {errores.pesoKg && <small className="field-error">{errores.pesoKg}</small>}
                </label>
                <label className="field">
                  <span>Número de chip (opcional)</span>
                  <input
                    className="control"
                    onChange={(event) => setFormulario({ ...formulario, chip: event.target.value })}
                    value={formulario.chip}
                  />
                  {errores.chip && <small className="field-error">{errores.chip}</small>}
                </label>
              </div>
              <label className="field">
                <span>Fotos (opcional)</span>
                <textarea
                  className="control textarea"
                  onChange={(event) => setFormulario({ ...formulario, fotos: event.target.value })}
                  placeholder="Pega una URL por línea (máximo 5)"
                  rows={3}
                  value={formulario.fotos}
                />
                <small className="field__hint">
                  Pega el enlace de la imagen o el enlace compartido de Postimg/Drive. En Drive,
                  habilita el acceso para cualquier persona con el enlace.
                </small>
                {errores.fotos && <small className="field-error">{errores.fotos}</small>}
                {fotosPreview.length > 0 && (
                  <div aria-live="polite" className="pet-photo-previews">
                    {fotosPreview.map((foto) => (
                      <div className="pet-photo-preview" key={foto.original}>
                        {foto.estado === 'cargando' ? (
                          <span aria-label="Cargando vista previa" className="skeleton" />
                        ) : foto.estado === 'error' ? (
                          <span aria-hidden="true" className="pet-photo-preview__fallback">
                            ♡
                          </span>
                        ) : (
                          <img
                            alt="Vista previa de la foto de la mascota"
                            onError={() =>
                              setFotosPreview((actuales) =>
                                actuales.map((item) =>
                                  item.original === foto.original
                                    ? {
                                        ...item,
                                        estado: 'error',
                                        mensaje:
                                          'No se pudo cargar la imagen. Verifica que el enlace sea público y apunte a una imagen.',
                                      }
                                    : item,
                                ),
                              )
                            }
                            src={foto.url}
                          />
                        )}
                        <span>
                          {foto.estado === 'error'
                            ? (foto.mensaje ??
                              'No se pudo cargar la imagen; conservamos el enlace.')
                            : foto.estado === 'cargando'
                              ? 'Preparando vista previa…'
                              : 'Vista previa'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </label>
              <div className="form-actions">
                <VetoButton onClick={() => setModal(false)} variant="secondary">
                  Cancelar
                </VetoButton>
                <VetoButton loading={guardando} type="submit">
                  Guardar
                </VetoButton>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
