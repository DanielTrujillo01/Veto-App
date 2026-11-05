import Link from 'next/link';
import { AlertBox, StatusBadge } from '@/components/ui/veto-components';
import { notFound } from 'next/navigation';
import { VeterinarioCard } from '@/components/VeterinarioCard';
import { api, ApiError } from '@/lib/api';

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
  duracionMin: number;
  precioBase: number;
};

export default async function FichaClinica({
  params,
  searchParams,
}: {
  params: Promise<{ clinicaId: string }>;
  searchParams: Promise<{ especieId?: string }>;
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
            {servicios.length} servicios disponibles en {sedes.length}{' '}
            {sedes.length === 1 ? 'sede' : 'sedes'}.
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
      <div className="clinic-profile__body">
        <div className="clinic-profile__main">
          <section aria-labelledby="team-title" className="clinic-section">
            <div className="clinic-section__heading">
              <div>
                <p className="eyebrow eyebrow--dark">CONOCE A QUIENES TE ATIENDEN</p>
                <h2 id="team-title">Equipo veterinario</h2>
              </div>
              <StatusBadge tone="neutral">{ficha.veterinarios.length} profesionales</StatusBadge>
            </div>
            {ficha.veterinarios.length ? (
              <div className="clinic-vet-grid">
                {ficha.veterinarios.map((veterinario) => (
                  <VeterinarioCard key={veterinario.id} {...veterinario} />
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <h3>Esta clínica aún no ha registrado veterinarios</h3>
                <p>Vuelve pronto para conocer a su equipo.</p>
              </div>
            )}
          </section>
          <section aria-labelledby="branches-title" className="clinic-section">
            <p className="eyebrow eyebrow--dark">DÓNDE ENCONTRARNOS</p>
            <h2 id="branches-title">Sedes</h2>
            {sedes.length ? (
              <div className="branch-grid">
                {sedes.map((sede) => (
                  <article className="branch-card" key={sede.id}>
                    <span aria-hidden="true">⌖</span>
                    <div>
                      <h3>{sede.nombre}</h3>
                      <p>{sede.direccion}</p>
                      <small>{sede.ciudad}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <AlertBox tone="info" title="Consulta las opciones disponibles">
                La clínica aún no ha publicado sedes.
              </AlertBox>
            )}
          </section>
          <section aria-labelledby="services-title" className="clinic-section" id="servicios">
            <p className="eyebrow eyebrow--dark">CUIDADO A TU MEDIDA</p>
            <h2 id="services-title">Servicios disponibles</h2>
            <form action={`/clinicas/${clinicaId}`} className="clinic-species-filter">
              <label className="field">
                <span>Filtrar por especie</span>
                <select className="control" defaultValue={especieIdSeleccionada} name="especieId">
                  <option value="">Todas las especies</option>
                  {especies.map((especie) => (
                    <option key={especie.id} value={especie.id}>
                      {especie.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <button className="veto-button veto-button--secondary" type="submit">
                Aplicar filtro
              </button>
            </form>
            {servicios.length ? (
              <div className="service-public-list">
                {servicios.map((servicio) => (
                  <article className="service-public-card" key={servicio.id}>
                    <div>
                      <StatusBadge tone="info">{servicio.tipoServicio}</StatusBadge>
                      <h3>{servicio.nombre}</h3>
                      <p>{servicio.descripcion || 'Atención profesional para tu mascota.'}</p>
                      <small>
                        {servicio.modalidad === 'EN_SEDE' ? 'En sede' : 'A domicilio'} ·{' '}
                        {servicio.duracionMin} min
                      </small>
                    </div>
                    <strong>
                      {new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        maximumFractionDigits: 0,
                      }).format(servicio.precioBase)}
                    </strong>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <h3>
                  {especieIdSeleccionada
                    ? 'Aún no hay servicios para esta especie'
                    : 'Servicios próximamente'}
                </h3>
                <p>
                  {especieIdSeleccionada
                    ? 'Prueba con otra especie o consulta los servicios para todas las mascotas.'
                    : 'Esta clínica todavía no ha publicado servicios.'}
                </p>
              </div>
            )}
          </section>
        </div>
        <aside className="clinic-profile__sticky">
          <div className="clinic-booking-card">
            <span className="eyebrow eyebrow--dark">AGENDA TU VISITA</span>
            <strong>¿Listo para agendar?</strong>
            <p>Elige un servicio y encuentra el momento ideal para tu mascota.</p>
            <Link
              className="veto-button veto-button--primary"
              href={`/ingresar?returnTo=${encodeURIComponent(`/clinicas/${clinicaId}`)}`}
            >
              Ver servicios y agendar
            </Link>
          </div>
        </aside>
      </div>
      <Link className="workspace-back" href="/clinicas">
        Volver a clínicas
      </Link>
    </div>
  );
}
