import Link from 'next/link';

// HU-024: pantalla de inicio con buscador y accesos a veterinarias,
// veterinarios independientes y tienda (+ HU-086: acceso a Adopción).
const accesos = [
  { href: '/clinicas', titulo: 'Veterinarias', detalle: 'Clínicas con sus veterinarios' },
  {
    href: '/veterinarios',
    titulo: 'Veterinarios independientes',
    detalle: 'En sede o a domicilio',
  },
  { href: '/tienda', titulo: 'Tienda', detalle: 'Alimentos, accesorios e higiene' },
  { href: '/adopcion', titulo: 'Adopción', detalle: 'Mascotas que buscan hogar' },
];

export default function Inicio() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Todo para el cuidado de tu mascota</h1>
        <form action="/buscar" className="flex gap-2">
          <input
            type="search"
            name="q"
            placeholder="Busca un servicio, una clínica o un producto"
            aria-label="Buscar"
            className="w-full rounded-lg border border-borde bg-superficie px-4 py-2 outline-none focus:border-acento"
          />
          <button
            type="submit"
            className="rounded-lg bg-acento px-5 py-2 font-medium text-acento-texto"
          >
            Buscar
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {accesos.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-xl border border-borde bg-superficie p-5 transition hover:border-acento"
          >
            <h2 className="font-semibold">{a.titulo}</h2>
            <p className="text-sm text-suave">{a.detalle}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
