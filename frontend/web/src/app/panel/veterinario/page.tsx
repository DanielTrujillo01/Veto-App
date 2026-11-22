'use client';

/**
 * Panel del veterinario de una clínica. Muestra su agenda de citas (GET /citas, solo las
 * asignadas a él): próximas, por cerrar (ya empezaron y siguen agendadas) y pasadas. Desde cada
 * cita marca finalizada o "no asistió" y escribe recomendaciones (HU-032, HU-033).
 */

import { useCallback, useEffect, useState } from 'react';
import type { CitaDetalle, PerfilVeterinario } from '@veto/shared';
import {
  filtrarAgenda,
  ListaAgenda,
  porCerrar,
  proxima,
  type FiltroAgenda,
} from '@/components/panel/AgendaCitas';
import { BienvenidaPanel, IndicadoresPanel } from '@/components/panel/PanelResumen';
import { PanelShell } from '@/components/panel/PanelShell';
import { IconoCorazon, IconoEstetoscopio, IconoHuella, IconoReloj } from '@/components/ui/iconos';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';

const FILTROS: { valor: FiltroAgenda; texto: string }[] = [
  { valor: 'proximas', texto: 'Próximas' },
  { valor: 'por-cerrar', texto: 'Por cerrar' },
  { valor: 'pasadas', texto: 'Pasadas' },
  { valor: 'todas', texto: 'Todas' },
];

export default function PanelVeterinario() {
  const [perfil, setPerfil] = useState<PerfilVeterinario | null>(null);
  const [citas, setCitas] = useState<CitaDetalle[]>([]);
  const [filtro, setFiltro] = useState<FiltroAgenda>('proximas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [perfilVet, agenda] = await Promise.all([
        api<PerfilVeterinario>('/veterinarios/me'),
        api<CitaDetalle[]>('/citas?limite=200'),
      ]);
      setPerfil(perfilVet);
      setCitas(agenda);
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos cargar tu agenda. Verifica tu sesión e inténtalo de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ahora = Date.now();
  const proximas = citas.filter((cita) => proxima(cita, ahora)).length;
  const pendientesDeCierre = citas.filter((cita) => porCerrar(cita, ahora)).length;
  const atendidas = citas.filter((cita) => cita.estado === 'FINALIZADA').length;
  const visibles = filtrarAgenda(citas, filtro);
  const nombre = perfil?.usuario.nombre.split(' ')[0] ?? 'doctor';

  return (
    <PanelShell
      ficha={
        perfil
          ? {
              nombre: perfil.usuario.nombre,
              detalle: perfil.aliado.nombre,
              verificado: true,
              foto: perfil.fotoUrl,
            }
          : undefined
      }
      grupos={[
        {
          nombre: 'Espacio del profesional',
          items: [
            {
              id: 'agenda',
              etiqueta: 'Mi agenda',
              icono: <IconoEstetoscopio tamano={18} />,
              activo: true,
              alHacerClic: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
            },
          ],
        },
      ]}
      leyenda="Panel del veterinario"
      titulo="Mi agenda"
    >
      <BienvenidaPanel
        acento={
          pendientesDeCierre
            ? 'Tienes citas por cerrar.'
            : proximas
              ? `${proximas === 1 ? 'Tienes 1 cita próxima' : `Tienes ${proximas} citas próximas`}.`
              : 'Todo al día.'
        }
        saludo={`Hola, ${nombre}.`}
        textoCompleto={
          pendientesDeCierre
            ? 'Abre cada cita que ya pasó para marcarla como finalizada o no asistió y dejar tus recomendaciones.'
            : 'Aquí verás las citas que los tutores reservan contigo.'
        }
        textoPendiente=""
      />
      <IndicadoresPanel
        items={[
          {
            valor: proximas,
            texto: proximas === 1 ? 'Cita próxima' : 'Citas próximas',
            accion: 'Ver próximas',
            alHacerClic: () => setFiltro('proximas'),
            icono: <IconoReloj tamano={20} />,
            tono: 'burgundy',
          },
          {
            valor: pendientesDeCierre,
            texto: 'Por cerrar',
            accion: 'Ver por cerrar',
            alHacerClic: () => setFiltro('por-cerrar'),
            icono: <IconoHuella tamano={20} />,
            tono: 'peach',
          },
          {
            valor: atendidas,
            texto: atendidas === 1 ? 'Cita atendida' : 'Citas atendidas',
            accion: 'Ver pasadas',
            alHacerClic: () => setFiltro('pasadas'),
            icono: <IconoCorazon tamano={20} />,
            tono: 'sage',
          },
        ]}
      />

      {error && (
        <AlertBox tone="error" title="No se pudo cargar tu agenda">
          {error}{' '}
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      )}

      <section aria-labelledby="agenda-titulo" className="workspace-card ally-card">
        <div className="ally-card__head">
          <h2 id="agenda-titulo">Citas</h2>
        </div>
        <nav aria-label="Filtrar citas" className="search-result-tags">
          {FILTROS.map((opcion) => (
            <button
              aria-pressed={filtro === opcion.valor}
              className={filtro === opcion.valor ? 'is-active' : ''}
              key={opcion.valor}
              onClick={() => setFiltro(opcion.valor)}
              type="button"
            >
              {opcion.texto}
            </button>
          ))}
        </nav>
        {cargando ? (
          <div className="workspace-loading">
            <span className="skeleton pet-skeleton-line" />
            <span className="skeleton pet-skeleton-line" />
          </div>
        ) : (
          <ListaAgenda
            citas={visibles}
            vacio={
              filtro === 'proximas'
                ? {
                    titulo: 'No tienes citas próximas',
                    texto: 'Cuando un tutor reserve contigo, la cita aparecerá aquí.',
                  }
                : filtro === 'por-cerrar'
                  ? { titulo: 'No hay citas por cerrar', texto: 'Estás al día.' }
                  : {
                      titulo: 'Aún no hay citas aquí',
                      texto: 'Las citas aparecerán en esta lista.',
                    }
            }
          />
        )}
      </section>
    </PanelShell>
  );
}
