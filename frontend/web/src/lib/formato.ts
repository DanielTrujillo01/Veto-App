const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Precio en pesos colombianos sin decimales (§2.4), igual que en la ficha de la clínica. */
export function formatoPrecio(valor: number) {
  return pesos.format(valor);
}
