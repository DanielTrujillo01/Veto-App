'use client';

/** Campo "Buscar" de las tarjetas de filtros (clínicas, servicios), con el estilo de la tienda. */
export function CampoBusqueda({
  valor,
  onCambiar,
  etiqueta,
  placeholder,
  ancho = 2,
}: {
  valor: string;
  onCambiar: (valor: string) => void;
  etiqueta: string;
  placeholder: string;
  /** Columnas de la tarjeta de filtros que ocupa (de 3). */
  ancho?: 1 | 2 | 3;
}) {
  return (
    <div className={`field services-filters__search services-filters__search--${ancho}`}>
      <span>Buscar</span>
      <label className="catalog-search">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label={etiqueta}
          onChange={(evento) => onCambiar(evento.target.value)}
          placeholder={placeholder}
          type="search"
          value={valor}
        />
      </label>
    </div>
  );
}
