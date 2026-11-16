import { DetalleProducto } from './DetalleProducto';

/** HU-046 · Detalle de un producto de la tienda (público). */
export default async function PaginaProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetalleProducto id={id} />;
}
