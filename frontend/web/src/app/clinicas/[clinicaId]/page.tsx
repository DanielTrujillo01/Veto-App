import Link from 'next/link';
import { Avatar, StatusBadge } from '@/components/ui/veto-components';
import { notFound } from 'next/navigation';
import { Paginacion } from '@/components/Paginacion';
import { api, ApiError } from '@/lib/api';
import { formatoPrecio } from '@/lib/formato';
import { hrefConPagina, leerPagina, paginar } from '@/lib/paginacion';
import { NOMBRE_MODALIDAD } from '@/lib/servicios';

const SERVICIOS_POR_PAGINA = 6;

type FichaClinica = {
  id: string;
  nombre: string;
  descripcion: string | null;
  veterinarios: {
    id: string;
    nombre: string;
    fotoUrl: string | null;
    descripcion: string | null;
  }[];
};
type Sede = { id: string; nombre: string; direccion: string; ciudad: string };
type Especie = { id: number; nombre: string };
type Servicio = {
  id: string;
  nombre: string;
  tipoServicio: string;
  descripcion: string | null;
  modalidad: 'EN_SEDE' | 'A_DOMICILIO';
  sedeId: string | null;
  duracionMin: number;
  precioBase: number;
};

export default async function FichaClinica({
  params,
  searchParams,
}: {
  params: Promise<{ clinicaId: string }>;
  searchParams: Promise<{ especieId?: string; pagina?: string }>;
}) {
  const [{ clinicaId }, query] = await Promise.all([params, searchParams]);
  let ficha: FichaClinica;
  let sedes: Sede[] = [];
  let especies: Especie[] = [];
  let servicios: Servicio[] = [];
  let modoConfirmacion = 'NO_DISPONIBLE';
  let especieIdSeleccionada = '';
  try {
    [ficha, sedes, especies] = await Promise.all([
      api<FichaClinica>(`/aliados/${clinicaId}/veterinarios`, { cache: 'no-store' }),
      api<Sede[]>(`/aliados/${clinicaId}/sedes`, { cache: 'no-store' }),
      api<Especie[]>(`/aliados/${clinicaId}/especies`, { cache: 'no-store' }),
    ]);
    const idEspecie = Number(query.especieId);
    const especieSeleccionada = especies.find(
      (especie) => especie.id === idEspecie && Number.isInteger(idEspecie),
    );
    especieIdSeleccionada = especieSeleccionada?.id.toString() ?? '';
    const filtroEspecie = especieSeleccionada ? `?especieId=${especieSeleccionada.id}` : '';
    servicios = await api<Servicio[]>(`/aliados/${clinicaId}/servicios${filtroEspecie}`, {
      cache: 'no-store',
    });
    try {
      const confirmacion = await api<{ modo: string }>(`/aliados/${clinicaId}/confirmacion`, {
        cache: 'no-store',
      });
      modoConfirmacion = confirmacion.modo;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const paginaServicios = paginar(servicios, leerPagina(query.pagina), SERVICIOS_POR_PAGINA);
  const hrefPaginaServicios = (numero: number) =>
    `${hrefConPagina(`/clinicas/${clinicaId}`, { especieId: especieIdSeleccionada }, numero)}#servicios`;

  return (
    <div className="clinic-profile">
      <div className="clinic-profile__hero">
        <div className="clinic-profile__copy">
          <StatusBadge tone="success">✓ Aliado verificado</StatusBadge>
          <h1>{ficha.nombre}</h1>
          <p>{ficha.descripcion || 'Una clínica comprometida con el bienestar de tu mascota.'}</p>
          <div className="clinic-chip-row">
            {especies.map((especie) => (
              <span className="species-chip species-chip--selected" key={especie.id}>
                {especie.nombre}
              </span>
            ))}
          </div>
        </div>
        <aside className="clinic-booking-card">
          <span className="eyebrow eyebrow--dark">AGENDA TU VISITA</span>
          <strong>Encuentra el cuidado que buscas</strong>
          <p>
            {servicios.length}{' '}
            {servicios.length === 1 ? 'servicio disponible' : 'servicios disponibles'} en{' '}
            {sedes.length} {sedes.length === 1 ? 'sede' : 'sedes'}.
          </p>
          <a className="veto-button veto-button--primary" href="#servicios">
            Ver servicios y agendar
          </a>
          <small>
            {modoConfirmacion === 'NO_DISPONIBLE'
              ? 'La clínica todavía no recibe reservas en línea.'
              : `Confirmación ${modoConfirmacion === 'AUTOMATICA' ? 'automática' : 'manual'} según disponibilidad.`}
          </small>
        </aside>
      </div>
      <div className="detail-columns">
        <section aria-labelledby="services-title" className="detail-panel" id="servicios">
          <div className="detail-panel__head">
            <div>
              <p className="eyebrow eyebrow--dark">CUIDADO A TU MEDIDA</p>
              <h2 id="services-title">Servicios</h2>
            </div>
            <form action={`/clinicas/${clinicaId}`} className="detail-filter">
              <label className="sr-only" htmlFor="clinica-especie">
                Filtrar por especie
              </label>
              <select
                className="control"
                defaultValue={especieIdSeleccionada}
                id="clinica-especie"
                name="especieId"
              >
                <option value="">Todas las especies</option>
                {especies.map((especie) => (
                  <option key={especie.id} value={especie.id}>
                    {especie.nombre}
                  </option>
                ))}
              </select>
              <button className="veto-button veto-button--secondary" type="submit">
                Filtrar
              </button>
            </form>
          </div>
          {servicios.length ? (
            <>
              <div className="service-public-list">
                {paginaServicios.items.map((servicio) => {
                  const sede = sedes.find((s) => s.id === servicio.sedeId);
                  return (
                    <Link
                      className="service-public-card service-public-card--link"
                      href={`/servicios/${servicio.id}`}
                      key={servicio.id}
                    >
                      <div>
                        <StatusBadge tone="info">{servicio.tipoServicio}</StatusBadge>
                        <h3>{servicio.nombre}</h3>
                        <small>
                          {NOMBRE_MODALIDAD[servicio.modalidad]}
                          {sede ? ` en ${sede.nombre}` : ''} · {servicio.duracionMin} min
                        </small>
                      </div>
                      <span className="service-public-card__price">
                        <strong>{formatoPrecio(servicio.precioBase)}</strong>
                        <span className="text-action">Ver y reservar →</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              <div className="detail-panel__foot">
                <p className="catalog-results__count">
                  {paginaServicios.desde}–{paginaServicios.hasta} de {paginaServicios.total}{' '}
                  {paginaServicios.total === 1 ? 'servicio' : 'servicios'}
                </p>
                <Paginacion
                  etiqueta="servicios de la clínica"
                  hrefDe={hrefPaginaServicios}
                  pagina={paginaServicios.pagina}
                  totalPaginas={paginaServicios.totalPaginas}
                />
              </div>
            </>
          ) : (
            <div className="empty-state empty-state--compact">
              <h3>
                {especieIdSeleccionada
                  ? 'Aún no hay servicios para esta especie'
                  : 'Servicios próximamente'}
              </h3>
              <p>
                {especieIdSeleccionada
                  ? 'Prueba con otra especie o mira todos los servicios.'
                  : 'Esta clínica todavía no ha publicado servicios.'}
              </p>
            </div>
          )}
        </section>

        <div className="detail-side">
          <section aria-labelledby="team-title" className="detail-panel">
            <div className="detail-panel__head">
              <h2 id="team-title">Equipo veterinario</h2>
              <span className="detail-count">{ficha.veterinarios.length}</span>
            </div>
            {ficha.veterinarios.length ? (
              <ul className="detail-people">
                {ficha.veterinarios.map((veterinario) => (
                  <li key={veterinario.id}>
                    <Avatar image={veterinario.fotoUrl ?? undefined} name={veterinario.nombre} />
                    <span>
                      <strong>{veterinario.nombre}</strong>
                      <small>{veterinario.descripcion || 'Médico veterinario'}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="detail-empty">Esta clínica aún no ha registrado veterinarios.</p>
            )}
          </section>

          <section aria-labelledby="branches-title" className="detail-panel">
            <div className="detail-panel__head">
              <h2 id="branches-title">Sedes</h2>
              <span className="detail-count">{sedes.length}</span>
            </div>
            {sedes.length ? (
              <ul className="detail-places">
                {sedes.map((sede) => (
                  <li key={sede.id}>
                    <span aria-hidden="true">⌖</span>
                    <span>
                      <strong>{sede.nombre}</strong>
                      <small>
                        {sede.direccion} · {sede.ciudad}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="detail-empty">La clínica aún no ha publicado sedes.</p>
            )}
          </section>
        </div>
      </div>
      <Link className="workspace-back" href="/clinicas">
        Volver a clínicas
      </Link>
    </div>
  );
}
