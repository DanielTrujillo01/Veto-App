'use client';

/**
 * Selector de cantidad con botones − / + (en lugar de un desplegable largo). El número se
 * puede escribir; siempre queda entre 1 y el máximo disponible.
 */
export function SelectorCantidad({
  valor,
  maximo,
  onCambiar,
  etiqueta = 'Cantidad',
}: {
  valor: number;
  maximo: number;
  onCambiar: (valor: number) => void;
  etiqueta?: string;
}) {
  const ajustar = (n: number) => onCambiar(Math.max(1, Math.min(maximo, Math.round(n) || 1)));
  return (
    <div aria-label={etiqueta} className="qty-stepper" role="group">
      <button
        aria-label="Quitar uno"
        disabled={valor <= 1}
        onClick={() => ajustar(valor - 1)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="18"
        >
          <path d="M6 12h12" />
        </svg>
      </button>
      <input
        aria-label={etiqueta}
        inputMode="numeric"
        max={maximo}
        min={1}
        onChange={(evento) => ajustar(Number(evento.target.value))}
        type="number"
        value={valor}
      />
      <button
        aria-label="Agregar uno"
        disabled={valor >= maximo}
        onClick={() => ajustar(valor + 1)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="18"
        >
          <path d="M6 12h12M12 6v12" />
        </svg>
      </button>
    </div>
  );
}
