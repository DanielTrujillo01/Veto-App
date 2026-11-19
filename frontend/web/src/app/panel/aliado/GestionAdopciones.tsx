'use client';

/**
 * Panel de la fundación · Publicaciones de adopción.
 *
 * - HU-080/081: publicar una mascota con nombre, especie, edad, sexo, tamaño y ubicación
 *   (ciudad o zona, nunca la dirección) y descripción opcional. Nada identifica a la fundación.
 * - HU-082/083: editar, pausar, volver a publicar, marcar en proceso, adoptada o retirar, con las
 *   mismas transiciones que valida la API. Adoptada y retirada son finales y se confirman.
 * - HU-084: varias fotos (hasta 10, la primera es la portada) y un video opcional por enlace.
 * - HU-085: solo las mascotas de esta fundación, con filtro por estado y paginación.
 *
 * API: GET /adopciones/mis-publicaciones?estado, POST /adopciones, PUT /adopciones/:id,
 * PATCH /adopciones/:id/estado y GET /mascotas/especies.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ESTADOS_MASCOTA_ADOPCION,
  MAX_FOTOS_ADOPCION,
  SEXOS_ANIMAL,
  TAMANOS_MASCOTA,
  publicarMascotaAdopcionSchema,
  type EstadoMascotaAdopcion,
  type MascotaAdopcion,
} from '@veto/shared';
import { FotoProducto } from '@/components/FotoProducto';
import { FotosEditor } from '@/components/FotosEditor';
import { Paginacion } from '@/components/Paginacion';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import {
  ACCIONES_ADOPCION,
  ESTADO_ADOPCION,
  NOMBRE_SEXO,
  NOMBRE_TAMANO,
  textoEdad,
} from '@/lib/adopcion';
import { api, ApiError } from '@/lib/api';
import { erroresPorCampo } from '@/lib/errores';
import { separarEnlaces, urlDeImagen } from '@/lib/fotos';
import { paginar } from '@/lib/paginacion';

const POR_PAGINA = 8;
const MAX_DESCRIPCION = 500;

type Formulario = {
  nombre: string;
  especieId: string;
  anos: string;
  meses: string;
  sexo: string;
  tamano: string;
  ubicacion: string;
  descripcion: string;
  fotos: string;
  videoUrl: string;
};

const vacio: Formulario = {
  nombre: '',
  especieId: '',
  anos: '',
  meses: '',
  sexo: '',
  tamano: '',
  ubicacion: '',
  descripcion: '',
  fotos: '',
  videoUrl: '',
};

function desdePublicacion(m: MascotaAdopcion): Formulario {
  return {
    nombre: m.nombre,
    especieId: String(m.especieId),
    anos: String(Math.floor(m.edadMeses / 12)),
    meses: String(m.edadMeses % 12),
    sexo: m.sexo,
    tamano: m.tamano,
    ubicacion: m.ubicacion,
    descripcion: m.descripcion ?? '',
    fotos: m.fotos.join('\n'),
    videoUrl: m.videoUrl ?? '',
  };
}

/** Edad en meses a partir de años y meses; undefined si ambos están vacíos (es obligatoria). */
function edadEnMeses(f: Formulario) {
  if (f.anos.trim() === '' && f.meses.trim() === '') return undefined;
  return Number(f.anos || 0) * 12 + Number(f.meses || 0);
}

export function GestionAdopciones() {
  const [publicaciones, setPublicaciones] = useState<MascotaAdopcion[]>([]);
  const [especies, setEspecies] = useState<{ id: number; nombre: string }[]>([]);
  const [filtro, setFiltro] = useState<EstadoMascotaAdopcion | ''>('');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<MascotaAdopcion | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(vacio);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [fotosFallidas, setFotosFallidas] = useState<number[]>([]);

  const [porConfirmar, setPorConfirmar] = useState<{
    mascota: MascotaAdopcion;
    a: EstadoMascotaAdopcion;
    texto: string;
  } | null>(null);
  const [cambiando, setCambiando] = useState('');

  const nombreEspecie = useMemo(() => new Map(especies.map((e) => [e.id, e.nombre])), [especies]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      setPublicaciones(
        await api<MascotaAdopcion[]>(
          `/adopciones/mis-publicaciones${filtro ? `?estado=${filtro}` : ''}`,
        ),
      );
    } catch (causa) {
      setErrorCarga(
        causa instanceof ApiError ? causa.message : 'No pudimos cargar tus publicaciones.',
      );
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void api<{ id: number; nombre: string }[]>('/mascotas/especies').then(setEspecies, () =>
      setEspecies([]),
    );
  }, []);

  function abrir(mascota?: MascotaAdopcion) {
    setEditando(mascota ?? null);
    setFormulario(mascota ? desdePublicacion(mascota) : vacio);
    setErrores({});
    setErrorFormulario('');
    setFotosFallidas([]);
    setAbierto(true);
  }

  const campo = (nombre: keyof Formulario) => ({
    value: formulario[nombre],
    onChange: (evento: { target: { value: string } }) =>
      setFormulario((actual) => ({ ...actual, [nombre]: evento.target.value })),
    'aria-invalid': Boolean(errores[nombre]) || undefined,
  });

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario('');
    const validacion = publicarMascotaAdopcionSchema.safeParse({
      nombre: formulario.nombre,
      especieId: formulario.especieId ? Number(formulario.especieId) : undefined,
      edadMeses: edadEnMeses(formulario),
      sexo: formulario.sexo || undefined,
      tamano: formulario.tamano || undefined,
      ubicacion: formulario.ubicacion,
      descripcion: formulario.descripcion.trim() || undefined,
      fotos: separarEnlaces(formulario.fotos, MAX_FOTOS_ADOPCION),
      videoUrl: formulario.videoUrl.trim() || undefined,
    });
    if (!validacion.success) {
      const encontrados = erroresPorCampo(validacion.error);
      if (encontrados.edadMeses) encontrados.edad = encontrados.edadMeses;
      setErrores(encontrados);
      return;
    }
    if (fotosFallidas.length > 0) {
      setErrores({ fotos: 'Corrige o quita los enlaces marcados: no cargan una imagen.' });
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      const fotos: string[] = [];
      const fallidas: Record<string, string> = {};
      for (const [i, enlace] of validacion.data.fotos.entries()) {
        try {
          fotos.push(await urlDeImagen(enlace));
        } catch (causa) {
          fallidas[`fotos.${i}`] =
            causa instanceof Error ? causa.message : 'No pudimos leer este enlace.';
        }
      }
      if (Object.keys(fallidas).length > 0) {
        setErrores(fallidas);
        return;
      }
      await api<MascotaAdopcion>(`/adopciones${editando ? `/${editando.id}` : ''}`, {
        method: editando ? 'PUT' : 'POST',
        body: JSON.stringify({ ...validacion.data, fotos }),
      });
      setAbierto(false);
      setAviso({
        tono: 'success',
        texto: editando
          ? `Guardamos los cambios de ${validacion.data.nombre}.`
          : `${validacion.data.nombre} ya está publicada y disponible en el catálogo.`,
      });
      await cargar();
    } catch (causa) {
      if (causa instanceof ApiError && Object.keys(causa.fieldErrors).length > 0) {
        setErrores(causa.fieldErrors);
      }
      setErrorFormulario(
        causa instanceof ApiError ? causa.message : 'No pudimos guardar la publicación.',
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(mascota: MascotaAdopcion, a: EstadoMascotaAdopcion) {
    setCambiando(mascota.id);
    setAviso(null);
    try {
      await api(`/adopciones/${mascota.id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: a }),
      });
      setAviso({
        tono: 'success',
        texto: `${mascota.nombre} quedó como “${ESTADO_ADOPCION[a].texto}”. ${ESTADO_ADOPCION[a].ayuda}`,
      });
      await cargar();
    } catch (causa) {
      setAviso({
        tono: 'error',
        texto: causa instanceof ApiError ? causa.message : 'No pudimos cambiar el estado.',
      });
    } finally {
      setPorConfirmar(null);
      setCambiando('');
    }
  }

  const resultado = paginar(publicaciones, pagina, POR_PAGINA);
  const largoDescripcion = [...formulario.descripcion.trim()].length;

  return (
    <section className="workspace-card">
      <div className="workspace-card__title-row">
        <div>
          <h2>Mascotas en adopción</h2>
          <p className="workspace-card__intro">
            Publica y gestiona tus mascotas. En el catálogo nunca se muestra tu fundación ni tu
            dirección.
          </p>
        </div>
        <VetoButton onClick={() => abrir()}>＋ Publicar mascota</VetoButton>
      </div>

      {aviso && (
        <AlertBox
          tone={aviso.tono}
          title={aviso.tono === 'success' ? 'Cambios guardados' : 'No se pudo completar'}
        >
          {aviso.texto}
        </AlertBox>
      )}

      <nav aria-label="Filtrar por estado" className="search-result-tags">
        {(['', ...ESTADOS_MASCOTA_ADOPCION] as const).map((valor) => (
          <button
            aria-pressed={filtro === valor}
            className={filtro === valor ? 'is-active' : ''}
            key={valor || 'todas'}
            onClick={() => {
              setFiltro(valor);
              setPagina(1);
            }}
            type="button"
          >
            {valor ? ESTADO_ADOPCION[valor].texto : 'Todas'}
          </button>
        ))}
      </nav>

      {cargando ? (
        <div className="workspace-loading" aria-label="Cargando publicaciones" aria-live="polite">
          <span className="skeleton pet-skeleton-line" />
          <span className="skeleton pet-skeleton-line" />
          <span className="skeleton pet-skeleton-line pet-skeleton-line--short" />
        </div>
      ) : errorCarga ? (
        <AlertBox tone="error" title={errorCarga}>
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      ) : resultado.total === 0 ? (
        <div className="empty-state empty-state--compact">
          <span className="empty-state__illustration" aria-hidden="true">
            ♡
          </span>
          <h3>
            {filtro
              ? `No tienes mascotas en estado “${ESTADO_ADOPCION[filtro].texto}”`
              : 'Aún no has publicado mascotas'}
          </h3>
          <p>
            {filtro
              ? 'Cambia el filtro para ver las demás.'
              : 'Publica la primera para que los tutores la conozcan.'}
          </p>
        </div>
      ) : (
        <>
          <p className="catalog-results__count">
            Mostrando {resultado.desde}–{resultado.hasta} de {resultado.total}
          </p>
          <div className="entity-list">
            {resultado.items.map((mascota) => (
              <article className="entity-row" key={mascota.id}>
                <div className="product-row__main">
                  <FotoProducto nombre={mascota.nombre} url={mascota.fotos[0]} />
                  <div>
                    <h3>{mascota.nombre}</h3>
                    <p>
                      {nombreEspecie.get(mascota.especieId) ?? 'Mascota'} ·{' '}
                      {textoEdad(mascota.edadMeses)} · {NOMBRE_SEXO[mascota.sexo]} ·{' '}
                      {NOMBRE_TAMANO[mascota.tamano]}
                    </p>
                    <p>
                      ⌖ {mascota.ubicacion} · {mascota.fotos.length}{' '}
                      {mascota.fotos.length === 1 ? 'foto' : 'fotos'}
                      {mascota.videoUrl ? ' · video' : ''}
                    </p>
                  </div>
                </div>
                <StatusBadge tone={ESTADO_ADOPCION[mascota.estado].tono}>
                  {ESTADO_ADOPCION[mascota.estado].texto}
                </StatusBadge>
                <div className="entity-actions">
                  {ACCIONES_ADOPCION[mascota.estado].length > 0 && (
                    <button className="text-action" onClick={() => abrir(mascota)} type="button">
                      Editar
                    </button>
                  )}
                  {ACCIONES_ADOPCION[mascota.estado].map((accion) => (
                    <button
                      className="text-action"
                      disabled={cambiando === mascota.id}
                      key={accion.a}
                      onClick={() =>
                        accion.final
                          ? setPorConfirmar({ mascota, a: accion.a, texto: accion.texto })
                          : void cambiarEstado(mascota, accion.a)
                      }
                      type="button"
                    >
                      {accion.texto}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <Paginacion
            etiqueta="publicaciones"
            onCambiar={setPagina}
            pagina={resultado.pagina}
            totalPaginas={resultado.totalPaginas}
          />
        </>
      )}

      {abierto && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="adopcion-formulario-titulo"
            aria-modal="true"
            className="workspace-modal"
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') setAbierto(false);
            }}
            role="dialog"
          >
            <h2 id="adopcion-formulario-titulo">
              {editando ? `Editar a ${editando.nombre}` : 'Publicar mascota en adopción'}
            </h2>
            {errorFormulario && (
              <AlertBox tone="error" title="No se pudo guardar">
                {errorFormulario}
              </AlertBox>
            )}
            <form className="form-stack" noValidate onSubmit={guardar}>
              <div className="form-two-col">
                <label className="field">
                  <span>Nombre *</span>
                  <input autoFocus className="control" maxLength={80} {...campo('nombre')} />
                  {errores.nombre && <small className="field-error">{errores.nombre}</small>}
                </label>
                <label className="field">
                  <span>Especie *</span>
                  <select className="control" {...campo('especieId')}>
                    <option value="">Selecciona la especie</option>
                    {especies.map((especie) => (
                      <option key={especie.id} value={especie.id}>
                        {especie.nombre}
                      </option>
                    ))}
                  </select>
                  {errores.especieId && <small className="field-error">{errores.especieId}</small>}
                </label>
              </div>
              <fieldset className="booking-fieldset">
                <legend>Edad aproximada *</legend>
                <div className="form-two-col">
                  <label className="field">
                    <span>Años</span>
                    <input
                      className="control"
                      inputMode="numeric"
                      max="30"
                      min="0"
                      type="number"
                      {...campo('anos')}
                    />
                  </label>
                  <label className="field">
                    <span>Meses</span>
                    <input
                      className="control"
                      inputMode="numeric"
                      max="11"
                      min="0"
                      type="number"
                      {...campo('meses')}
                    />
                  </label>
                </div>
                {errores.edad && <small className="field-error">{errores.edad}</small>}
              </fieldset>
              <div className="form-two-col">
                <label className="field">
                  <span>Sexo *</span>
                  <select className="control" {...campo('sexo')}>
                    <option value="">Selecciona</option>
                    {SEXOS_ANIMAL.map((sexo) => (
                      <option key={sexo} value={sexo}>
                        {NOMBRE_SEXO[sexo]}
                      </option>
                    ))}
                  </select>
                  {errores.sexo && <small className="field-error">{errores.sexo}</small>}
                </label>
                <label className="field">
                  <span>Tamaño *</span>
                  <select className="control" {...campo('tamano')}>
                    <option value="">Selecciona</option>
                    {TAMANOS_MASCOTA.map((tamano) => (
                      <option key={tamano} value={tamano}>
                        {NOMBRE_TAMANO[tamano]}
                      </option>
                    ))}
                  </select>
                  {errores.tamano && <small className="field-error">{errores.tamano}</small>}
                </label>
              </div>
              <label className="field">
                <span>Ubicación (ciudad o zona) *</span>
                <input
                  className="control"
                  maxLength={160}
                  placeholder="Ej. Cali, Norte"
                  {...campo('ubicacion')}
                />
                <small className="field__hint">
                  No escribas la dirección ni el nombre de la fundación: se muestra en el catálogo.
                </small>
                {errores.ubicacion && <small className="field-error">{errores.ubicacion}</small>}
              </label>
              <label className="field">
                <span>Descripción (opcional)</span>
                <textarea
                  className="control textarea"
                  maxLength={MAX_DESCRIPCION}
                  placeholder="Personalidad, cuidados, con quién se lleva bien…"
                  {...campo('descripcion')}
                />
                <small
                  className={`character-count${largoDescripcion >= MAX_DESCRIPCION ? ' character-count--limit' : ''}`}
                >
                  {largoDescripcion}/{MAX_DESCRIPCION}
                </small>
                {errores.descripcion && (
                  <small className="field-error">{errores.descripcion}</small>
                )}
              </label>
              <FotosEditor
                descripcionImagen="foto de la mascota"
                error={errores.fotos}
                erroresPorFoto={Object.fromEntries(
                  Object.entries(errores).flatMap(([clave, mensaje]) => {
                    const posicion = /^fotos\.(\d+)$/.exec(clave)?.[1];
                    return posicion ? [[Number(posicion), mensaje]] : [];
                  }),
                )}
                id="adopcion-fotos"
                marcarPortada
                maximo={MAX_FOTOS_ADOPCION}
                onChange={(fotos) => {
                  setFormulario((actual) => ({ ...actual, fotos }));
                  setErrores((actuales) =>
                    Object.fromEntries(
                      Object.entries(actuales).filter(([clave]) => !clave.startsWith('fotos')),
                    ),
                  );
                }}
                onFallidas={setFotosFallidas}
                valor={formulario.fotos}
              />
              <label className="field">
                <span>Video (opcional)</span>
                <input
                  className="control"
                  inputMode="url"
                  placeholder="Enlace de YouTube, Drive u otro sitio"
                  type="url"
                  {...campo('videoUrl')}
                />
                {errores.videoUrl && <small className="field-error">{errores.videoUrl}</small>}
              </label>
              <div className="form-actions">
                <VetoButton onClick={() => setAbierto(false)} variant="secondary">
                  Cancelar
                </VetoButton>
                <VetoButton loading={guardando} type="submit">
                  {editando ? 'Guardar cambios' : 'Publicar'}
                </VetoButton>
              </div>
            </form>
          </section>
        </div>
      )}

      {porConfirmar && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="adopcion-confirmar"
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            role="alertdialog"
          >
            <p className="eyebrow eyebrow--dark">ESTE CAMBIO ES DEFINITIVO</p>
            <h2 id="adopcion-confirmar">
              ¿{porConfirmar.texto} a {porConfirmar.mascota.nombre}?
            </h2>
            <p>
              {porConfirmar.a === 'ADOPTADA'
                ? 'Saldrá del catálogo y ya no se podrá editar. ¡Felicitaciones!'
                : 'Saldrá del catálogo y ya no se podrá volver a publicar.'}
            </p>
            <div className="form-actions">
              <VetoButton onClick={() => setPorConfirmar(null)} variant="secondary">
                Cancelar
              </VetoButton>
              <VetoButton
                loading={cambiando === porConfirmar.mascota.id}
                onClick={() => void cambiarEstado(porConfirmar.mascota, porConfirmar.a)}
                variant={porConfirmar.a === 'RETIRADA' ? 'danger' : 'primary'}
              >
                {porConfirmar.texto}
              </VetoButton>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
