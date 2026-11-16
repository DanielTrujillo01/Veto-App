'use client';

/**
 * HU-044 · Sección "Productos" del panel de la tienda.
 *
 * Lista, crea, edita, desactiva y reactiva productos. Está en su propio componente (acuerdo §8.3
 * de las historias refinadas) para no seguir creciendo `page.tsx`; la página solo lo renderiza.
 *
 * API que consume (documentada en apps/api/src/modules/README.md, sección HU-044):
 *   GET   /productos/categorias
 *   GET   /aliados/:aliadoId/productos?q=&estado=todos|activos|inactivos
 *   POST  /aliados/:aliadoId/productos
 *   PUT   /aliados/:aliadoId/productos/:id
 *   PATCH /aliados/:aliadoId/productos/:id/desactivar | activar
 *
 * Diseño: piezas y clases existentes del panel (workspace-card, list-toolbar, entity-row,
 * workspace-modal, empty-state, AlertBox, StatusBadge, VetoButton). Solo se agregó
 * `.product-row__main` en globals.css (portada + datos en la primera columna de la fila).
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  guardarProductoSchema,
  MAX_DESCRIPCION_PRODUCTO,
  MAX_FOTOS_PRODUCTO,
  type CategoriaProducto,
  type EstadoFiltroProducto,
  type ProductoGestion,
} from '@veto/shared';
import { FotoProducto } from '@/components/FotoProducto';
import { FotosEditor } from '@/components/FotosEditor';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { erroresPorCampo } from '@/lib/errores';
import { separarEnlaces, urlDeImagen } from '@/lib/fotos';
import { formatoPrecio } from '@/lib/formato';

type Formulario = {
  nombre: string;
  categoriaId: string;
  precio: string;
  stock: string;
  descripcion: string;
  fotos: string;
};

const formularioVacio: Formulario = {
  nombre: '',
  categoriaId: '',
  precio: '',
  stock: '',
  descripcion: '',
  fotos: '',
};

function desdeProducto(producto: ProductoGestion): Formulario {
  return {
    nombre: producto.nombre,
    categoriaId: String(producto.categoriaId),
    precio: String(producto.precio),
    stock: String(producto.stock),
    descripcion: producto.descripcion ?? '',
    fotos: producto.fotos.join('\n'),
  };
}

/** Número del campo, o undefined si está vacío (así el esquema dice "es obligatorio"). */
const numero = (texto: string) => (texto.trim() === '' ? undefined : Number(texto));

/** Cuenta caracteres como los ve una persona (tildes y emojis valen uno, §2.4). */
const largo = (texto: string) => [...texto].length;

export function ProductosTienda({ aliadoId }: { aliadoId: string }) {
  const [productos, setProductos] = useState<ProductoGestion[]>([]);
  const [categorias, setCategorias] = useState<CategoriaProducto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [estado, setEstado] = useState<EstadoFiltroProducto>('todos');
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null);

  const [editando, setEditando] = useState<ProductoGestion | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [formulario, setFormulario] = useState<Formulario>(formularioVacio);
  const [formularioInicial, setFormularioInicial] = useState<Formulario>(formularioVacio);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [fotosFallidas, setFotosFallidas] = useState<number[]>([]);

  const [porDesactivar, setPorDesactivar] = useState<ProductoGestion | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const hayCambios = useMemo(
    () => JSON.stringify(formulario) !== JSON.stringify(formularioInicial),
    [formulario, formularioInicial],
  );

  // La búsqueda se aplica al dejar de escribir, para no consultar en cada tecla.
  useEffect(() => {
    const espera = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300);
    return () => clearTimeout(espera);
  }, [busqueda]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const parametros = new URLSearchParams({ estado });
      if (busquedaAplicada) parametros.set('q', busquedaAplicada);
      setProductos(
        await api<ProductoGestion[]>(`/aliados/${aliadoId}/productos?${parametros.toString()}`),
      );
    } catch {
      setErrorCarga('No pudimos cargar tus productos.');
    } finally {
      setCargando(false);
    }
  }, [aliadoId, busquedaAplicada, estado]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    api<CategoriaProducto[]>('/productos/categorias')
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  // Avisa al cerrar o recargar la pestaña con cambios sin guardar (regla 6).
  useEffect(() => {
    if (!formularioAbierto || !hayCambios) return;
    const alSalir = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [formularioAbierto, hayCambios]);

  function abrir(producto?: ProductoGestion) {
    const inicial = producto ? desdeProducto(producto) : formularioVacio;
    setEditando(producto ?? null);
    setFormulario(inicial);
    setFormularioInicial(inicial);
    setErrores({});
    setErrorFormulario('');
    setAviso(null);
    setFormularioAbierto(true);
  }

  function cerrar(forzar = false) {
    if (!forzar && hayCambios) {
      setConfirmarDescarte(true);
      return;
    }
    setConfirmarDescarte(false);
    setFormularioAbierto(false);
  }

  /** Errores de un enlace concreto ("fotos.2") para marcarlo en su vista previa. */
  const erroresPorFoto = useMemo(() => {
    const resultado: Record<number, string> = {};
    for (const [campo, mensaje] of Object.entries(errores)) {
      const coincidencia = /^fotos\.(\d+)$/.exec(campo);
      if (coincidencia) resultado[Number(coincidencia[1])] = mensaje;
    }
    return resultado;
  }, [errores]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario('');
    const validacion = guardarProductoSchema.safeParse({
      nombre: formulario.nombre,
      categoriaId: numero(formulario.categoriaId),
      precio: numero(formulario.precio),
      stock: numero(formulario.stock),
      descripcion: formulario.descripcion,
      fotos: separarEnlaces(formulario.fotos),
    });
    if (!validacion.success) {
      setErrores(erroresPorCampo(validacion.error));
      return;
    }
    if (fotosFallidas.length > 0) {
      // Un enlace que no carga se marca y no se guarda nada; el formulario queda como estaba.
      setErrores({ fotos: 'Corrige o quita los enlaces marcados: no cargan una imagen.' });
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      // Los enlaces compartidos (Postimg, Drive) se guardan como la imagen directa. Si uno no se
      // puede leer, se marca ese enlace y no se guarda nada (el formulario queda como estaba).
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

      const ruta = `/aliados/${aliadoId}/productos${editando ? `/${editando.id}` : ''}`;
      await api<ProductoGestion>(ruta, {
        method: editando ? 'PUT' : 'POST',
        body: JSON.stringify({ ...validacion.data, fotos }),
      });
      setFormularioAbierto(false);
      setAviso({
        tono: 'success',
        texto: editando ? 'Producto guardado.' : 'Producto creado. Ya aparece en la tienda.',
      });
      await cargar();
    } catch (causa) {
      if (causa instanceof ApiError && Object.keys(causa.fieldErrors).length > 0) {
        setErrores(causa.fieldErrors);
      }
      setErrorFormulario(
        causa instanceof ApiError ? causa.message : 'No pudimos guardar el producto.',
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(producto: ProductoGestion, activo: boolean) {
    setCambiandoEstado(true);
    setAviso(null);
    try {
      await api(
        `/aliados/${aliadoId}/productos/${producto.id}/${activo ? 'activar' : 'desactivar'}`,
        {
          method: 'PATCH',
        },
      );
      setPorDesactivar(null);
      setAviso({
        tono: 'success',
        texto: activo
          ? `${producto.nombre} volvió a la tienda.`
          : `${producto.nombre} salió de la tienda. Los pedidos anteriores no cambian.`,
      });
      await cargar();
    } catch (causa) {
      setPorDesactivar(null);
      setAviso({
        tono: 'error',
        texto: causa instanceof ApiError ? causa.message : 'No pudimos cambiar el estado.',
      });
    } finally {
      setCambiandoEstado(false);
    }
  }

  const hayFiltros = busquedaAplicada !== '' || estado !== 'todos';

  return (
    <section className="workspace-card">
      <div className="workspace-card__title-row">
        <div>
          <h2>Productos</h2>
          <p className="workspace-card__intro">
            Crea y actualiza los productos que verán los tutores en la tienda.
          </p>
        </div>
        <VetoButton onClick={() => abrir()}>＋ Crear producto</VetoButton>
      </div>

      {aviso && (
        <AlertBox
          tone={aviso.tono}
          title={
            aviso.tono === 'success' ? 'Cambios guardados' : 'No se pudo completar la solicitud'
          }
        >
          {aviso.texto}
        </AlertBox>
      )}

      <div className="list-toolbar">
        <label className="field field--inline">
          <span>Buscar por nombre</span>
          <input
            className="control"
            maxLength={100}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Ej.: concentrado"
            type="search"
            value={busqueda}
          />
        </label>
        <label className="field field--inline">
          <span>Estado</span>
          <select
            className="control"
            onChange={(evento) => setEstado(evento.target.value as EstadoFiltroProducto)}
            value={estado}
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>
        <span className="field__hint">Los productos inactivos no se muestran en la tienda.</span>
      </div>

      {cargando ? (
        <div className="workspace-loading" aria-live="polite" aria-label="Cargando productos">
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
      ) : productos.length ? (
        <div className="entity-list">
          {productos.map((producto) => (
            <article className="entity-row" key={producto.id}>
              <div className="product-row__main">
                <FotoProducto nombre={producto.nombre} url={producto.fotos[0]} />
                <div>
                  <h3>{producto.nombre}</h3>
                  <p>
                    {producto.categoria} · Stock: {producto.stock}
                  </p>
                  <div className="service-price-block">
                    <strong className="service-price">{formatoPrecio(producto.precio)}</strong>
                  </div>
                </div>
              </div>
              <StatusBadge
                tone={producto.ocultoPorVeto ? 'warning' : producto.activo ? 'success' : 'neutral'}
              >
                {producto.ocultoPorVeto
                  ? 'Oculto por Veto'
                  : producto.activo
                    ? 'Activo'
                    : 'Inactivo'}
              </StatusBadge>
              <div className="entity-actions">
                <button className="text-action" onClick={() => abrir(producto)} type="button">
                  Editar
                </button>
                <button
                  className="text-action"
                  disabled={cambiandoEstado}
                  onClick={() =>
                    producto.activo
                      ? setPorDesactivar(producto)
                      : void cambiarActivo(producto, true)
                  }
                  type="button"
                >
                  {producto.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : hayFiltros ? (
        <div className="empty-state empty-state--compact">
          <h3>No encontramos productos con esos filtros</h3>
          <p>Prueba con otro nombre o muestra todos los estados.</p>
          <VetoButton
            onClick={() => {
              setBusqueda('');
              setBusquedaAplicada('');
              setEstado('todos');
            }}
            variant="secondary"
          >
            Quitar filtros
          </VetoButton>
        </div>
      ) : (
        <div className="empty-state empty-state--compact">
          <span className="empty-state__illustration" aria-hidden="true">
            ⌂
          </span>
          <h3>Aún no has creado productos</h3>
          <p>Publica tu primer producto para que los tutores puedan encontrarlo en la tienda.</p>
        </div>
      )}

      {formularioAbierto && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="producto-formulario-titulo"
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') cerrar();
            }}
            role="dialog"
          >
            <h2 id="producto-formulario-titulo">
              {editando ? 'Editar producto' : 'Crear producto'}
            </h2>
            {errorFormulario && (
              <AlertBox tone="error" title="No se pudo guardar">
                {errorFormulario}
              </AlertBox>
            )}
            <form className="form-stack" noValidate onSubmit={guardar}>
              <label className="field">
                <span>Nombre</span>
                <input
                  aria-invalid={Boolean(errores.nombre) || undefined}
                  autoFocus
                  className="control"
                  maxLength={120}
                  onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })}
                  value={formulario.nombre}
                />
                {errores.nombre && <small className="field-error">{errores.nombre}</small>}
              </label>
              <label className="field">
                <span>Categoría</span>
                <select
                  aria-invalid={Boolean(errores.categoriaId) || undefined}
                  className="control"
                  onChange={(e) => setFormulario({ ...formulario, categoriaId: e.target.value })}
                  value={formulario.categoriaId}
                >
                  <option value="">Selecciona la categoría</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
                {errores.categoriaId && (
                  <small className="field-error">{errores.categoriaId}</small>
                )}
              </label>
              <div className="form-two-col">
                <label className="field">
                  <span>Precio (COP)</span>
                  <input
                    aria-invalid={Boolean(errores.precio) || undefined}
                    className="control"
                    inputMode="numeric"
                    min="1"
                    onChange={(e) => setFormulario({ ...formulario, precio: e.target.value })}
                    step="1"
                    type="number"
                    value={formulario.precio}
                  />
                  {errores.precio && <small className="field-error">{errores.precio}</small>}
                </label>
                <label className="field">
                  <span>Stock (unidades)</span>
                  <input
                    aria-invalid={Boolean(errores.stock) || undefined}
                    className="control"
                    inputMode="numeric"
                    min="0"
                    onChange={(e) => setFormulario({ ...formulario, stock: e.target.value })}
                    step="1"
                    type="number"
                    value={formulario.stock}
                  />
                  {errores.stock && <small className="field-error">{errores.stock}</small>}
                </label>
              </div>
              <label className="field">
                <span>Descripción (opcional)</span>
                <textarea
                  aria-invalid={Boolean(errores.descripcion) || undefined}
                  className="control textarea"
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
                  value={formulario.descripcion}
                />
                <small className="character-count">
                  {largo(formulario.descripcion).toLocaleString('es-CO')}/
                  {MAX_DESCRIPCION_PRODUCTO.toLocaleString('es-CO')}
                </small>
                {errores.descripcion && (
                  <small className="field-error">{errores.descripcion}</small>
                )}
              </label>
              <FotosEditor
                descripcionImagen="foto del producto"
                error={errores.fotos}
                erroresPorFoto={erroresPorFoto}
                id="producto-fotos"
                marcarPortada
                maximo={MAX_FOTOS_PRODUCTO}
                onFallidas={setFotosFallidas}
                onChange={(fotos) => {
                  setFormulario({ ...formulario, fotos });
                  // Al cambiar los enlaces se quitan sus errores anteriores.
                  setErrores((actuales) =>
                    Object.fromEntries(
                      Object.entries(actuales).filter(([campo]) => !campo.startsWith('fotos')),
                    ),
                  );
                }}
                valor={formulario.fotos}
              />
              <div className="form-actions">
                <VetoButton onClick={() => cerrar()} variant="secondary">
                  Cancelar
                </VetoButton>
                <VetoButton loading={guardando} type="submit">
                  Guardar producto
                </VetoButton>
              </div>
            </form>
          </section>
        </div>
      )}

      {confirmarDescarte && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="producto-descartar-titulo"
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            role="alertdialog"
          >
            <p className="eyebrow eyebrow--dark">CAMBIOS SIN GUARDAR</p>
            <h2 id="producto-descartar-titulo">¿Salir sin guardar?</h2>
            <p>Perderás los cambios que hiciste en este producto.</p>
            <div className="form-actions">
              <VetoButton onClick={() => setConfirmarDescarte(false)} variant="secondary">
                Seguir editando
              </VetoButton>
              <VetoButton onClick={() => cerrar(true)} variant="danger">
                Salir sin guardar
              </VetoButton>
            </div>
          </section>
        </div>
      )}

      {porDesactivar && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="producto-desactivar-titulo"
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            role="alertdialog"
          >
            <p className="eyebrow eyebrow--dark">CONFIRMA EL CAMBIO</p>
            <h2 id="producto-desactivar-titulo">¿Desactivar {porDesactivar.nombre}?</h2>
            <p>
              Saldrá de la tienda de inmediato y ya no se podrá comprar. Puedes volver a activarlo
              cuando quieras; los pedidos anteriores no cambian.
            </p>
            <div className="form-actions">
              <VetoButton onClick={() => setPorDesactivar(null)} variant="secondary">
                Cancelar
              </VetoButton>
              <VetoButton
                loading={cambiandoEstado}
                onClick={() => void cambiarActivo(porDesactivar, false)}
                variant="danger"
              >
                Desactivar
              </VetoButton>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
