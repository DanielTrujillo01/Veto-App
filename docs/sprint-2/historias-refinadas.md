# Sprint 2 · Historias refinadas

Este documento completa las historias del sprint 2 con lo que el backlog deja abierto: qué incluye
cada una, sus reglas, criterios de aceptación y DoD. **No cambia lo que hace ninguna historia.** El
objetivo es que dos personas (o un agente de IA) que implementen historias distintas lleguen a
resultados que encajen entre sí.

Está escrito sobre lo que ya existe en la rama `develop` al cierre del sprint 1.

**Cómo leerlo**

1. **§1 Punto de partida:** lo que ya está hecho y lo que falta, para no rehacer nada.
2. **§2 Reglas comunes:** aplican a todas las historias. Si una historia no dice nada sobre un tema
   (cómo se muestra un precio, qué pasa si no hay resultados…), manda lo que dice aquí.
3. **§3 Acuerdos entre historias:** dónde dos o más historias se tocan y quién hace qué, para que
   no haya trabajo repetido ni comportamientos distintos para lo mismo.
4. **§4 a §7 Historias,** cada una con el mismo formato: historia · qué incluye y qué no · de qué
   depende · reglas · criterios de aceptación · notas para quien implementa · DoD.
5. **§8 Orden de trabajo** · **§9 Decisiones a confirmar con el PO** · **§10 Hallazgos del
   sprint 1 que afectan este sprint.**

---

## 1. Punto de partida (lo que ya hay en `develop`)

| Tema                         | Ya existe                                                                                                                                                                                                      | Falta (lo hace este sprint)                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Inicio                       | Pantalla con buscador ("¿Qué necesitas?" + "¿Dónde?"), cuatro tarjetas de acceso (Veterinarias, Veterinarios, Tienda, Adopción) y accesos a servicios frecuentes. Menú superior con buscador y enlaces.        | Que los destinos funcionen con datos reales.                          |
| Veterinarias                 | `/clinicas`: listado de clínicas activas con carga, vacío y error. `/clinicas/[id]`: ficha con equipo, sedes, especies, servicios (con filtro por especie) y modo de confirmación.                             | Precio "desde", detalle de servicio y botón de reserva real.          |
| Veterinarios independientes  | Solo una página informativa (`/veterinarios`), sin datos.                                                                                                                                                      | Listado y ficha.                                                      |
| Búsqueda (`/buscar`)         | Página informativa, sin resultados.                                                                                                                                                                            | Toda la búsqueda, los filtros y el orden.                             |
| Servicios, precios, especies | Servicios con precio base y reglas de precio por especie/peso/edad (HU-018, 020); cotización para una mascota del tutor; especies que atiende cada aliado (HU-021); catálogos de tipos de servicio y especies. | Búsqueda general (hoy solo se listan los servicios de un aliado).     |
| Calendario                   | Horario semanal, bloqueos y cálculo de espacios libres por servicio y veterinario (HU-022, hasta 31 días por consulta).                                                                                        | La pantalla donde el tutor elige fecha y hora, y la reserva.          |
| Citas                        | Reglas en la base: sin solapamientos, sin duplicados, estado inicial según el modo de confirmación del aliado (automática → _Agendada_; manual → _Pendiente_), solo el aliado finaliza (HU-023).               | Reservar, "Mis citas", agenda del aliado, finalizar, recomendaciones. |
| Consulta clínica             | El veterinario ve sus consultas (HU-014). Registrar anamnesis y cerrar consulta aún no están.                                                                                                                  | —(no es de este sprint)                                               |
| Tienda                       | Página informativa con categorías de ejemplo que **no coinciden** con las de la base. En el panel de la tienda, la sección Productos dice "próximamente". La base ya tiene productos, fotos y pedidos.         | Todo: gestión de productos, catálogo, detalle y elegir producto.      |
| Fundaciones                  | Registro (HU-078) y aprobación por el Equipo Veto (HU-079). Su panel solo muestra un mensaje.                                                                                                                  | Publicar y gestionar mascotas.                                        |
| Adopción pública             | Página informativa. La base tiene la tabla de mascotas en adopción (con una sola foto) y una vista pública que ya oculta a la fundación.                                                                       | Catálogo, filtros y detalle.                                          |
| Fotos                        | Se guardan como **enlaces** (http/https). Para mascotas del tutor se pegan enlaces y los de Postimg se convierten solos en la imagen. No hay subida de archivos.                                               | Usar lo mismo para productos y adopción.                              |
| Piezas de interfaz           | Botones, alertas, insignias de estado, esqueletos de carga, estado vacío, avatar con inicial (guía en `/componentes`).                                                                                         | Reutilizarlas; no crear otras parecidas.                              |

---

## 2. Reglas comunes (aplican a todas las historias)

### 2.1 Quién puede hacer qué

- **Sin iniciar sesión** se puede ver: inicio, búsqueda, filtros, fichas y detalles de servicios;
  tienda y detalle de productos; catálogo y detalle de adopción.
- **Se necesita sesión** para: reservar y ver "Mis citas" (tutor); gestionar la agenda, finalizar
  citas y escribir recomendaciones (aliado o veterinario); gestionar productos (tienda); publicar
  y gestionar mascotas en adopción (fundación aprobada).
- Si alguien intenta ver o cambiar algo que no es suyo (una cita de otro tutor, un producto de
  otra tienda…), recibe "no encontrado", igual que si no existiera. Así no se revela que existe.
- Un aliado que no está **activo** no aparece en búsquedas ni catálogos y no puede gestionar
  nada (ya es la regla del sprint 1).
- Cuando una acción pide iniciar sesión, se va a `/ingresar` y **después de ingresar se vuelve a
  donde estaba** (hoy esto no funciona, ver §10).

### 2.2 Listados, filtros y páginas

- Los listados muestran **20 elementos por página**, con paginación debajo.
- **La dirección (URL) guarda la búsqueda, los filtros, el orden y la página.** Recargar,
  compartir el enlace o volver atrás muestra lo mismo. Cambiar un filtro o el orden vuelve a la
  página 1.
- Cada filtro activo se ve como una etiqueta con una ✕ para quitarlo, y hay un botón **Quitar
  filtros** que los quita todos (conserva lo escrito en el buscador y el orden).
- Cada filtro admite **un solo valor** a la vez en este sprint.
- Un valor de filtro inválido en la URL (por ejemplo, alguien la editó a mano) se ignora: nunca
  produce una pantalla de error.

### 2.3 Cómo se busca un texto

Una sola regla para buscar servicios (HU-025) y productos (HU-045):

1. No importan mayúsculas, minúsculas ni tildes ("Peluquería" = "peluqueria").
2. Se ignoran los espacios al inicio, al final y repetidos.
3. Se necesitan al menos **2 caracteres**; con menos, se avisa junto al campo y no se busca. Máximo 100.
4. Si se escriben varias palabras, cada resultado debe contenerlas **todas** (en cualquiera de los
   campos donde se busca y en cualquier orden).
5. Caracteres como `%` o `_` se buscan tal cual.

### 2.4 Cómo se muestran los datos

| Dato                       | Regla                                                                                                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precio                     | Pesos colombianos sin decimales: "$45.000" (ya se hace así en la ficha de la clínica).                                                                                                                                                             |
| Precio con reglas          | Si el servicio cambia de precio según la mascota (HU-020), en listados se muestra **"Desde $X"**, donde X es el menor precio posible. El precio exacto aparece al elegir la mascota.                                                               |
| Fecha y hora               | Siempre en hora de Colombia: "lunes 15 de diciembre · 9:30 a. m.".                                                                                                                                                                                 |
| Edad                       | Se guarda en meses y se muestra así: "Menos de 1 mes", "5 meses", "1 año", "2 años y 3 meses".                                                                                                                                                     |
| Ubicación                  | Ciudad (y zona, si la hay): "Chapinero, Bogotá". Las ciudades se comparan sin tildes ni mayúsculas, y de lo escrito en "¿Dónde?" se toma lo que va antes de la coma ("Bogotá, Colombia" → "Bogotá").                                               |
| Estados                    | Nunca el valor interno (`A_DOMICILIO`), siempre el texto: "A domicilio", "En sede", "Pendiente", "Agendada", "Finalizada", "No asistió", "Disponible", "Pausada", "En proceso", "Adoptada", "Retirada"… con el mismo color en todas las pantallas. |
| Textos que escribe alguien | Se muestran tal cual, respetando los saltos de línea. Los límites de caracteres cuentan tildes y emojis como un carácter.                                                                                                                          |

### 2.5 Estados de pantalla

Toda pantalla o sección que trae datos tiene estos cuatro estados, con las piezas que ya existen:

| Estado    | Qué se ve                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Cargando  | Esqueletos con la forma del contenido. Nunca una pantalla en blanco.                                   |
| Vacío     | Un mensaje propio de esa pantalla y una acción para salir del vacío (por ejemplo, **Quitar filtros**). |
| Error     | "No pudimos cargar…" y un botón **Reintentar**. Nunca el mensaje técnico del servidor.                 |
| No existe | Para un detalle que no existe o ya no está disponible: un mensaje y un enlace para volver al listado.  |

Además:

- Un aviso de éxito ("Cita reservada", "Producto guardado") **solo** aparece cuando el servidor
  confirmó. Si falla, se muestra el error y lo escrito en el formulario se conserva.
- Los errores de un formulario se muestran junto a cada campo.
- Mientras se guarda, el botón se deshabilita y muestra que está trabajando (evita el doble clic).

### 2.6 Tamaños de pantalla y accesibilidad

- Se revisa en **celular (360 px), tableta (768 px) y computador (1280 px)**: sin desplazamiento
  horizontal, sin textos cortados y con botones fáciles de tocar.
- Las tarjetas se acomodan en 1 columna en celular, 2 en tableta y 3 en computador.
- Todo se puede usar con teclado; cada campo tiene su etiqueta; cada imagen tiene descripción; el
  enlace de la sección actual del menú se marca como activo.

### 2.7 Fotos y video

- Igual que en las mascotas del tutor: **se pegan enlaces**, no se suben archivos. Se aceptan
  enlaces web (http o https); los enlaces compartidos de Postimg se convierten solos en la imagen.
- Antes de guardar se ve una vista previa de cada foto; si un enlace no carga, se marca ese enlace
  con un error y los demás siguen.
- **La primera foto de la lista es la portada.** El orden de la lista es el orden en que se
  muestran.
- Si un elemento no tiene foto o la foto no carga, se muestra una imagen genérica (o la inicial
  del nombre, como ya hace la ficha del veterinario), sin romper el diseño.
- Límites: hasta **5 fotos** por producto y por mascota en adopción (el mismo límite que ya tienen
  las mascotas del tutor), y **1 video** opcional por mascota en adopción (ver HU-084).

### 2.8 Privacidad de las fundaciones (adopción)

En todo lo público de adopción (tarjetas, detalle, filtros y lo que responde el servidor) **nunca**
aparece el nombre, la dirección, el contacto, el logo ni ningún dato que identifique a la
fundación. Solo la ciudad y la zona de la mascota. Esto aplica a HU-081, 087, 088 y 089, y se
comprueba con una prueba automática (HU-081).

### 2.9 DoD común (además del DoD de cada historia)

- [ ] Se cumplen todos los criterios de aceptación de la historia.
- [ ] Se respetan las reglas comunes de esta sección.
- [ ] Se reutilizan las piezas de interfaz existentes (guía en `/componentes`); no se crean
      versiones nuevas de botones, alertas, insignias o tarjetas.
- [ ] Las validaciones del formulario son las mismas en la pantalla y en el servidor (esquemas
      compartidos en `@veto/shared`).
- [ ] El servidor comprueba quién hace la acción y que el recurso es suyo.
- [ ] Hay pruebas automáticas de las reglas de la historia y pasan `pnpm format:check`,
      `pnpm lint`, `pnpm typecheck` y `pnpm test` (y `pnpm db:test` si cambió la base).
- [ ] Se revisó en celular, tableta y computador, con capturas en el pull request.
- [ ] Los endpoints nuevos aparecen documentados en `/api/docs`.
- [ ] Un pull request por historia, revisado por alguien que no la implementó.

---

## 3. Acuerdos entre historias

Estos son los puntos donde dos o más historias se tocan. Cada acuerdo dice qué historia es dueña
de qué, para que no se haga dos veces ni de dos formas distintas.

| #    | Historias                    | El cruce                                                                             | Acuerdo                                                                                                                                                                                                                                                                                                     |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | 024 · 086                    | Ambas hablan de accesos desde el inicio.                                             | HU-024 se encarga de Veterinarias, Veterinarios independientes y Tienda. HU-086 se encarga de Adopción (tarjeta del inicio y menú).                                                                                                                                                                         |
| A-02 | 024 · 025 · 045              | El buscador del inicio y el del menú dicen buscar "servicios, productos o clínicas". | `/buscar` busca **servicios** (con su clínica o veterinario). Los productos se buscan en `/tienda` (HU-045). Si no hay servicios, `/buscar` ofrece "Buscar «…» en la tienda". El texto de ayuda del buscador del menú pasa a "Servicio, veterinario o clínica", igual que el del inicio.                    |
| A-03 | 024 · 026                    | El buscador del inicio ya tiene un campo "¿Dónde?".                                  | "¿Dónde?" **es** el filtro de ubicación de HU-026: al buscar desde el inicio llega a `/buscar` como ciudad.                                                                                                                                                                                                 |
| A-04 | 024 · 028                    | Listados de aliados y fichas.                                                        | `/clinicas` y `/veterinarios` muestran **aliados** (clínicas y veterinarios independientes) y llevan a su ficha. `/buscar` muestra **servicios** y lleva al detalle del servicio. Clínica y veterinario independiente usan **la misma ficha** (la de `/clinicas/[id]`, extendida).                          |
| A-05 | 028                          | "Detalle de servicio, aliado, sede o veterinario".                                   | Hay **dos pantallas de detalle**: la **ficha del aliado** (que ya muestra sus sedes y su equipo veterinario) y el **detalle del servicio** (nuevo). Las sedes y los veterinarios de una clínica se ven dentro de la ficha, no en páginas aparte. Para un veterinario independiente, su ficha es su detalle. |
| A-06 | 025 · 026 · 027 · 045 · 088  | Varios listados con buscador, filtros y orden.                                       | Una sola forma de hacerlo (§2.2 y §2.3) y las mismas piezas de interfaz para filtros, etiquetas de filtros activos y paginación. Las crea HU-026 y las reutilizan HU-045 y HU-088.                                                                                                                          |
| A-07 | 026 · 027 · 028              | El precio de un servicio puede variar según la mascota.                              | Una sola regla de precio mostrado (§2.4): "Desde $X" sin datos de la mascota; precio exacto con ellos. El orden por precio y el filtro de precio usan **el mismo valor que se ve en pantalla**.                                                                                                             |
| A-08 | 026 · 029 · 031              | La especie que atiende un aliado.                                                    | Se usa la regla del sprint 1 (HU-021): un aliado que no tiene especies configuradas no atiende ninguna. Como así nadie puede reservarle, **sus servicios no aparecen en la búsqueda**. En la reserva, las mascotas de especies no atendidas se ven deshabilitadas.                                          |
| A-09 | 029 · 022 (sprint 1)         | El calendario.                                                                       | El cálculo de horas libres **ya existe** (HU-022). HU-029 solo construye la pantalla y usa ese cálculo; no se crea otro.                                                                                                                                                                                    |
| A-10 | 029 · 030 · 031              | Son pasos de una misma reserva.                                                      | Una sola pantalla de reserva en cuatro pasos: **mascota → fecha y hora → motivo → confirmar**. Lo elegido se conserva al avanzar, retroceder o recargar.                                                                                                                                                    |
| A-11 | 031 · 023 (sprint 1)         | "La reserva queda con el estado correcto".                                           | El estado lo decide la base según el modo de confirmación del aliado: **Agendada** (automática) o **Pendiente** (manual). La pantalla muestra el estado que devolvió el servidor, con un mensaje distinto para cada caso. Nadie calcula el estado por su cuenta.                                            |
| A-12 | 031 · 032 · 033              | El tutor necesita ver el resultado de su cita.                                       | HU-031 crea **"Mis citas"** (lista y detalle). HU-032 y HU-033 no crean pantallas para el tutor: el estado nuevo y las recomendaciones aparecen ahí.                                                                                                                                                        |
| A-13 | 032 · 033                    | Cerrar la cita y escribir recomendaciones.                                           | **Una sola acción**: el aliado elige "Finalizada" (con recomendaciones opcionales) o "No asistió" (sin recomendaciones). Se guarda todo junto o nada.                                                                                                                                                       |
| A-14 | 032 · 023 (sprint 1)         | Las citas _Pendientes_ no se pueden finalizar, y hoy nadie puede aceptarlas.         | La agenda de HU-032 es el lugar natural para **Aceptar / Rechazar** citas pendientes (lo que quedó faltando de HU-023). Ver decisión D-01: sin esto, un aliado con confirmación manual nunca podrá finalizar una cita.                                                                                      |
| A-15 | 030 · 033 · consulta clínica | Tres textos parecidos.                                                               | **Motivo de la cita** (HU-030): lo escribe el tutor al reservar. **Recomendaciones** (HU-033): las escribe el aliado al finalizar la cita. **Motivo de consulta** (anamnesis, HU-037): lo escribe el veterinario en la consulta clínica; no es de este sprint. Son campos distintos y no se mezclan.        |
| A-16 | 044 · 045 · 046              | Qué producto se puede comprar.                                                       | Una sola definición de **producto visible**: activo, no ocultado por moderación y de una tienda activa. Un producto visible con stock 0 se muestra como **Agotado** (se ve, pero no se puede agregar).                                                                                                      |
| A-17 | 046 · 047 (siguiente)        | Dónde termina "elegir un producto".                                                  | HU-046 termina al **agregar al carrito**. El carrito y el pedido son de HU-047. El formato del carrito se acuerda aquí (HU-046) para que HU-047 lo use tal cual.                                                                                                                                            |
| A-18 | 080 · 081                    | Ambas definen la ubicación de la mascota.                                            | HU-080 pide la ubicación como dato obligatorio. HU-081 define **cómo** es (ciudad + zona opcional, sin dirección) y cómo se muestra. Se implementan con el mismo formulario.                                                                                                                                |
| A-19 | 082 · 083 · 085              | Pausar y retirar (082) y gestionar estados (083) son lo mismo visto de dos formas.   | **Un solo ciclo de estados** (tabla en §7) y una sola acción de "cambiar estado". _Pausar_, _Reanudar_ y _Retirar_ son botones rápidos de esa misma acción. El listado (085) muestra y filtra esos mismos estados.                                                                                          |
| A-20 | 080 · 084 · 087 · 089        | Fotos de la mascota en adopción.                                                     | HU-084 define las fotos y el video. HU-087 usa la **portada** (primera foto). HU-089 muestra **todas**. HU-080 no pide fotos: se agregan después de publicar, en la misma pantalla.                                                                                                                         |
| A-21 | 081 · 087 · 088 · 089        | La privacidad de la fundación se repite en varias historias.                         | Se define una vez (§2.8) y se prueba una vez (HU-081). Las demás historias solo deben leer los datos públicos ya preparados, nunca los de la fundación.                                                                                                                                                     |
| A-22 | 083 · 087 · 090 (siguiente)  | Qué mascotas se pueden adoptar.                                                      | Solo las **Disponibles** de una fundación aprobada aparecen en el catálogo y pueden recibir solicitudes. HU-090 (siguiente sprint) debe usar la misma regla.                                                                                                                                                |
| A-23 | 026 · 081 · 088              | Tres filtros o campos de ubicación.                                                  | La misma regla de ciudad (§2.4) para servicios y adopción.                                                                                                                                                                                                                                                  |

---

## 4. E05 · Búsqueda y descubrimiento

### HU-024 · Pantalla de inicio con buscador y accesos

> Como tutor, quiero ver una pantalla de inicio con buscador y accesos a veterinarias,
> veterinarios independientes y tienda.

**Qué incluye:** que el buscador y los accesos del inicio ya existentes lleven a secciones que
funcionan: `/clinicas` (ya funciona), `/veterinarios` (hoy informativa: pasa a ser el listado de
veterinarios independientes) y `/tienda` (su contenido es HU-045).
**Qué no incluye:** el acceso a Adopción (HU-086, acuerdo A-01); rediseñar el inicio.
**Depende de:** HU-025 (para que el buscador muestre resultados) y HU-045 (para la tienda).

**Reglas**

1. El buscador del inicio envía lo escrito en "¿Qué necesitas?" y en "¿Dónde?" a `/buscar`
   (acuerdo A-03). Si "¿Qué necesitas?" está vacío, igual muestra resultados filtrados por la
   ciudad.
2. **Veterinarias** → `/clinicas`: el listado actual de clínicas activas, sin cambios.
3. **Veterinarios independientes** → `/veterinarios`: listado de veterinarios independientes
   activos con el mismo diseño y los mismos estados que `/clinicas`. Cada tarjeta muestra nombre,
   foto (o inicial), descripción corta y si atiende a domicilio o en sede, y lleva a su ficha
   (HU-028). En la tarjeta del inicio el título pasa de "Veterinarios" a **"Veterinarios
   independientes"**, para que no se confunda con los veterinarios de las clínicas.
4. **Tienda** → `/tienda`.
5. En el menú superior se agrega **Veterinarias** junto a Veterinarios, Tienda y Adopción, para que
   las tres secciones de esta historia también estén en el menú.
6. Los accesos son estáticos (no cargan datos); los estados de carga, vacío y error se exigen en
   las secciones de destino (§2.5).

**Criterios de aceptación**

1. **Dado** un visitante en el inicio, **entonces** ve el buscador y los accesos a Veterinarias,
   Veterinarios independientes y Tienda, también en el menú.
2. **Dado** "baño" en ¿Qué necesitas? y "Medellín" en ¿Dónde?, **cuando** pulsa Buscar,
   **entonces** llega a `/buscar` con servicios de baño en Medellín.
3. **Cuando** pulsa Veterinarios independientes, **entonces** ve solo veterinarios independientes
   activos, y al pulsar uno llega a su ficha.
4. **Dado** que no hay veterinarios independientes, **entonces** ve el estado vacío; si el servidor
   falla, ve el error con Reintentar; mientras carga, ve esqueletos.
5. **Dado** un celular, una tableta o un computador, **entonces** todos los accesos se ven
   completos y funcionan con teclado y con el dedo.

**Notas para quien implementa**

- Hace falta un listado público de veterinarios independientes en el servidor, equivalente al de
  clínicas que ya existe (`GET /api/aliados/clinicas`).
- `/clinicas` y `/veterinarios` deben compartir el componente de tarjeta y de listado.

**DoD HU-024** (backlog)

- La pantalla inicial presenta el buscador y accesos a clínicas, veterinarios independientes y
  tiendas.
- Cada acceso lleva a la sección correspondiente y funciona en los tamaños de pantalla
  contemplados.
- Los elementos visibles muestran estados de carga, vacío o error cuando corresponde.

**Además:** `/veterinarios` deja de ser una página informativa; DoD común (§2.9).

---

### HU-025 · Buscar por palabra clave

> Como tutor, quiero buscar por palabra clave.

**Qué incluye:** la página `/buscar` con resultados reales de **servicios**, su tarjeta de
resultado, paginación y estados.
**Qué no incluye:** filtros (HU-026), orden (HU-027), búsqueda de productos (HU-045), sugerencias
mientras se escribe.
**Depende de:** nada (es la base de HU-026 y 027).

**Reglas**

1. **Dónde se busca:** nombre del servicio, descripción del servicio, tipo de servicio
   (consulta general, baño…), nombre de la clínica o del veterinario independiente, y ciudad de la
   sede.
2. **Cómo se busca:** la regla común de §2.3.
3. **Qué aparece:** solo servicios que se pueden reservar hoy: servicio activo, no ocultado por
   moderación, de un aliado activo que tiene especies configuradas (acuerdo A-08) y, si es en sede,
   con la sede activa. Es la misma regla que ya usa el detalle público de un servicio.
4. **Orden por defecto:** los que más se parecen a lo buscado primero; si no se escribió nada,
   por nombre.
5. **Tarjeta de resultado:** nombre del servicio, tipo, nombre del aliado, "En sede · Ciudad" o "A
   domicilio", precio (§2.4) y duración. La tarjeta lleva al detalle del servicio (HU-028) y el
   nombre del aliado, a su ficha.
6. **Sin resultados:** "No encontramos servicios para «…»", el texto sigue en el buscador para
   corregirlo, un botón **Limpiar búsqueda** y el enlace "Buscar «…» en la tienda" (acuerdo A-02).
7. El buscador del menú superior y el de `/buscar` llevan al mismo lugar y muestran lo mismo.

**Criterios de aceptación**

1. **Dado** un servicio "Baño y Peluquería Canina", **cuando** se busca `peluqueria`,
   `PELUQUERÍA` o ` baño   canina`, **entonces** aparece.
2. **Dado** `baño gato`, **entonces** solo aparecen servicios que contienen "baño" y "gato" en los
   campos de la regla 1.
3. **Dado** un servicio desactivado, de una sede inactiva o de un aliado no activo, **entonces** no
   aparece aunque coincida.
4. **Dado** una búsqueda sin coincidencias, **entonces** se ve el mensaje, se puede corregir el
   texto, limpiar la búsqueda o ir a la tienda.
5. **Dado** una sola letra, **entonces** se ve el aviso de mínimo 2 caracteres.
6. **Dado** más de 20 resultados, **entonces** hay paginación, la página 2 no repite resultados y
   al recargar se ve la misma página.

**Notas para quien implementa**

- Hace falta un endpoint público de búsqueda de servicios (hoy solo existe el listado por aliado).
  Debe responder con el mismo formato de páginas que ya usa la lista de consultas del veterinario:
  `{ items, total, pagina, limite }`, con `pagina` y `limite` como parámetros.
- Ignorar las tildes en la base requiere un cambio en la base de datos (ver §8, migración común).
- Dejar la búsqueda preparada para que HU-026 y HU-027 agreguen filtros y orden sin reescribirla.

**DoD HU-025** (backlog)

- La búsqueda devuelve resultados relacionados con la palabra clave en los campos acordados.
- La búsqueda tolera mayúsculas/minúsculas y espacios innecesarios conforme a la regla definida.
- Si no hay coincidencias, se informa claramente y se permite modificar la consulta.

**Además:** `/buscar` deja de ser una página informativa; DoD común (§2.9).

---

### HU-026 · Filtrar resultados

> Como tutor, quiero filtrar por especie, tipo de servicio, por edad, peso, precio, modalidad y
> ubicación.

**Qué incluye:** el panel de filtros de `/buscar`, las etiquetas de filtros activos y el botón
Quitar filtros. Estas piezas se reutilizan en la tienda y en adopción (acuerdo A-06).
**Qué no incluye:** elegir varios valores por filtro; usar una mascota registrada del tutor para
llenar los filtros.
**Depende de:** HU-025.

**Qué significa cada filtro**

| Filtro           | Qué hace                                                                                                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Especie          | Solo servicios de aliados que atienden esa especie (regla de HU-021).                                                                                                                                                                                                                    |
| Tipo de servicio | Solo ese tipo (consulta general, baño y peluquería, esterilización…).                                                                                                                                                                                                                    |
| Modalidad        | En sede o a domicilio.                                                                                                                                                                                                                                                                   |
| Ubicación        | Ciudad (§2.4). En sede: la ciudad de la sede. A domicilio: se asume que el aliado atiende a domicilio en las ciudades donde tiene sedes y, si no tiene sedes, en su ciudad de registro (decisión D-04).                                                                                  |
| Edad y peso      | **Son datos de la mascota y sirven para calcular su precio.** No quitan servicios por sí solos (ningún servicio se restringe por edad o peso; solo cambia su precio, HU-020). El panel lo explica: "Usamos la edad y el peso para mostrarte el precio para tu mascota". (Decisión D-03.) |
| Precio           | Mínimo y máximo, sobre **el precio que se ve en la tarjeta** (acuerdo A-07). Si se dio edad, peso o especie, es el precio calculado para esa mascota.                                                                                                                                    |

**Reglas**

1. Todos los filtros se combinan entre sí y con el texto buscado.
2. Las opciones de especie y tipo de servicio salen de los catálogos que ya existen en el sistema,
   no de listas escritas en la pantalla.
3. La edad se escribe como número con unidad (meses o años).
4. Un filtro que no aplica a un resultado no produce errores (por ejemplo, el peso en un servicio
   sin reglas de precio: se usa su precio base).
5. En computador, los filtros están a un lado y se aplican al cambiarlos. En celular, se abren en
   un panel con el botón **Ver resultados**.
6. Con filtros y sin resultados: "Ningún servicio cumple estos filtros" y **Quitar filtros**.

**Criterios de aceptación**

1. **Dado** el filtro Gato, **entonces** solo aparecen servicios de aliados que atienden gatos.
2. **Dado** A domicilio + Medellín, **entonces** solo aparecen servicios a domicilio de aliados que
   atienden en Medellín según la regla de ubicación.
3. **Dado** un servicio de $50.000 con la regla "perros de más de 20 kg: $80.000", **cuando** se
   filtra Perro + 25 kg, **entonces** la tarjeta dice "$80.000"; sin datos de la mascota dice
   "Desde $50.000".
4. **Dado** ese mismo caso con precio máximo $60.000, **entonces** el servicio no aparece con 25 kg y
   sí aparece sin peso.
5. **Dado** cuatro filtros activos, **entonces** cada resultado cumple los cuatro y se ven cuatro
   etiquetas de filtros.
6. **Cuando** se quita una etiqueta, **entonces** solo se quita ese filtro; con Quitar filtros vuelven
   todos los resultados de la búsqueda.

**Notas para quien implementa**

- Calcular el precio con datos sueltos (sin una mascota guardada) requiere una variante de la
  función de precio que ya existe; ambas deben compartir la misma lógica (migración común, §8).
- Las piezas de filtros deben poder reutilizarse con otros filtros (tienda, adopción).

**DoD HU-026** (backlog)

- Los filtros disponibles incluyen especie, tipo de servicio, edad, peso, precio, modalidad y
  ubicación, según los datos existentes.
- La combinación de varios filtros devuelve únicamente resultados que cumplen las condiciones
  seleccionadas.
- El usuario puede quitar filtros y recuperar resultados; los filtros no aplicables no generan
  errores.

**Además:** DoD común (§2.9).

---

### HU-027 · Ordenar resultados

> Como tutor, quiero ordenar resultados (por ejemplo, por precio).

**Qué incluye:** el selector "Ordenar por" en `/buscar`.
**Qué no incluye:** ordenar por distancia o por calificación (no hay esos datos); ordenar productos
o mascotas en adopción.
**Depende de:** HU-025 y HU-026 (el precio que se muestra).

**Opciones**

| Opción                | Cuándo está disponible                                           |
| --------------------- | ---------------------------------------------------------------- |
| Más relevantes        | Solo si se escribió texto. Es la opción por defecto en ese caso. |
| Precio: menor a mayor | Siempre.                                                         |
| Precio: mayor a menor | Siempre.                                                         |
| Nombre (A–Z)          | Siempre. Es la opción por defecto si no se escribió texto.       |

**Reglas**

1. El orden por precio usa **el mismo precio que muestra la tarjeta**, incluidos "Desde" y el
   precio calculado con edad y peso (acuerdo A-07).
2. El orden se aplica a **todos** los resultados antes de dividirlos en páginas (no solo a la
   página que se ve).
3. Con el mismo precio, se ordena por nombre; el orden no cambia al recargar.
4. Cambiar el orden conserva el texto y los filtros.

**Criterios de aceptación**

1. **Dado** "Precio: menor a mayor", **entonces** los precios nunca bajan de una tarjeta a la
   siguiente, tampoco al pasar de la página 1 a la 2.
2. **Dado** "Precio: mayor a menor" con un peso de 25 kg, **entonces** el orden sigue los precios
   calculados que se ven en pantalla.
3. **Dado** dos servicios con el mismo precio, **entonces** salen por nombre, siempre en el mismo
   orden.
4. **Dado** texto, filtros y un orden, **cuando** se cambia el orden, **entonces** el texto y los
   filtros se conservan.

**DoD HU-027** (backlog)

- El usuario puede ordenar los resultados por los criterios implementados, incluido precio si está
  disponible.
- El orden ascendente o descendente es consistente con los valores mostrados.
- La ordenación se combina correctamente con la búsqueda y los filtros activos.

**Además:** DoD común (§2.9).

---

### HU-028 · Ver el detalle de un servicio, aliado, sede o veterinario

> Como tutor, quiero ver el detalle de un servicio, aliado, sede o veterinario (precio, modalidad,
> ubicación, descripción).

**Qué incluye** (acuerdo A-05):

- **Detalle del servicio** (nuevo, `/servicios/[id]`).
- **Ficha del aliado:** la de la clínica (`/clinicas/[id]`) ya existe; se completa y se usa la
  misma para el veterinario independiente (`/veterinarios/[id]`).
- Las **sedes** y los **veterinarios** de una clínica se siguen viendo dentro de su ficha.
- El botón para **reservar** y la vuelta correcta después de iniciar sesión.

**Qué no incluye:** reseñas, mapas, el calendario completo (HU-029).
**Depende de:** HU-025 (la tarjeta de servicio).

**Qué muestra cada pantalla**

| Pantalla             | Contenido                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detalle del servicio | Nombre, tipo, descripción, modalidad, ubicación (nombre, dirección y ciudad de la sede, o "A domicilio"), duración, precio (§2.4, con la nota "El precio final depende de tu mascota" si varía), aliado (con enlace a su ficha), especies que atiende el aliado y el modo de confirmación ("Confirmación inmediata" o "La clínica confirmará tu cita"). Botón **Reservar**. |
| Ficha del aliado     | Lo que ya muestra la de la clínica (nombre, descripción, especies, equipo, sedes, servicios con filtro por especie) **más**: el precio de cada servicio con la regla de §2.4, y cada servicio enlazado a su detalle. Para un veterinario independiente: su foto, nombre, descripción, especies, modalidades y servicios (sin las secciones de equipo y sedes si no tiene).  |

**Reglas**

1. Un dato opcional que falta no deja huecos: la sección no aparece o se usa un valor alternativo
   (la inicial en vez de la foto). Hoy la ficha muestra textos de relleno como "Una clínica
   comprometida con el bienestar de tu mascota"; se mantienen solo donde el diseño ya los usa.
2. Un servicio, aliado o sede que no está disponible (desactivado, aliado no activo, sede
   inactiva) se trata como **no existe** (§2.5).
3. **Reservar**:
   - Tutor con sesión → va a la reserva de ese servicio (HU-029).
   - Sin sesión → va a ingresar y, después de ingresar, **vuelve a la reserva** (corrige lo
     señalado en §10).
   - Sesión de aliado, veterinario o Equipo Veto → no se muestra el botón; se ve "Solo los tutores
     pueden reservar".
4. El botón "Ver servicios y agendar" de la ficha (que hoy manda siempre a ingresar) lleva a la
   sección de servicios de la misma ficha.
5. Nunca se muestran datos privados: correo o celular de las cuentas, reglas de precio internas
   (solo el precio resultante).

**Criterios de aceptación**

1. **Dado** un servicio en sede, **entonces** su detalle muestra precio, "En sede", dirección y
   ciudad de la sede y descripción.
2. **Dado** un servicio a domicilio sin descripción, **entonces** se ve "A domicilio", no aparece la
   descripción y la página se ve completa.
3. **Dado** un veterinario independiente sin foto ni sedes, **entonces** su ficha muestra la inicial
   y no muestra secciones vacías.
4. **Dado** el detalle del servicio A, **entonces** todo lo que se ve es de A, aunque se navegue
   rápido entre detalles.
5. **Dado** un servicio desactivado o un enlace inexistente, **entonces** se ve "Este servicio ya no
   está disponible" con un enlace a la búsqueda.
6. **Dado** un visitante sin sesión, **cuando** pulsa Reservar e ingresa, **entonces** llega a la
   reserva de ese mismo servicio.
7. **Dado** una sesión de aliado, **entonces** no ve el botón Reservar.

**Notas para quien implementa**

- El detalle público del servicio ya existe en el servidor, pero devuelve solo los datos del
  servicio; hay que agregar aliado, sede, precio "desde" y modo de confirmación.
- La ficha de la clínica hoy solo acepta clínicas; debe aceptar también veterinarios
  independientes, reutilizando la misma pantalla.

**DoD HU-028** (backlog)

- La vista de detalle presenta los datos disponibles de servicio, aliado, sede o veterinario:
  precio, modalidad, ubicación y descripción.
- La información corresponde al elemento seleccionado y los datos opcionales ausentes se manejan
  sin romper la vista.
- Desde el detalle se puede continuar al flujo de reserva cuando el servicio está disponible.

**Además:** DoD común (§2.9).

---

## 5. E06 · Agendamiento y ciclo de vida de la cita

**La reserva (HU-029, 030 y 031)** es una sola pantalla en cuatro pasos (acuerdo A-10):

1. **Mascota.** El tutor elige una de sus mascotas. Las de especies que el aliado no atiende se ven
   deshabilitadas con "Este aliado no atiende <especie>". Al elegir, se muestra el precio exacto
   para esa mascota (la cotización ya existe, HU-020). Si no tiene mascotas, se le ofrece
   registrar una. _Este paso lo construye quien tome HU-029, que es la primera en implementarse._
2. **Fecha y hora** (HU-029).
3. **Motivo** (HU-030).
4. **Confirmar** (HU-031).

Lo elegido en cada paso se conserva al avanzar, retroceder o recargar. Cambiar la mascota borra la
fecha y la hora elegidas; cambiar el día borra la hora.

---

### HU-029 · Elegir fecha y hora en el calendario del aliado

> Como tutor, quiero elegir fecha y hora en el calendario del aliado.

**Qué incluye:** el paso 1 (mascota) y el paso 2 (calendario) de la reserva.
**Qué no incluye:** calcular las horas libres (ya existe, acuerdo A-09); reprogramar (HU-034);
apartar la hora mientras el tutor termina la reserva.
**Depende de:** el calendario de HU-022 (sprint 1); que el sistema use la hora de Colombia (§10,
riesgo de zona horaria).

**Reglas**

1. **Qué horas se ofrecen:** exactamente las que entrega el calendario del sprint 1: dentro del
   horario de cada veterinario, sin bloqueos, sin citas pendientes o agendadas que se crucen y con
   espacio para que el servicio quepa completo. Solo horas futuras.
2. **Rango:** los próximos **30 días**.
3. **Veterinario:** por defecto "Cualquier veterinario"; el tutor puede elegir uno en particular
   (el calendario ya devuelve el nombre de cada uno). Con "Cualquier veterinario", cada hora se
   muestra una sola vez aunque varios estén libres, y se asigna el primero que la tenga libre.
   Para un veterinario independiente no hay elección: es él.
4. **Calendario:** vista por mes; los días sin horas libres y los días pasados no se pueden elegir.
   Al elegir un día, se ven sus horas agrupadas en Mañana, Tarde y Noche. Si un día no tiene horas:
   "No hay horarios disponibles este día".
5. La hora elegida guarda también qué veterinario la atenderá; eso es lo que se reserva en HU-031.

**Criterios de aceptación**

1. **Dado** un veterinario que atiende los lunes de 8:00 a 12:00 y un servicio de 30 minutos,
   **entonces** el lunes ofrece 8:00, 8:30… 11:30.
2. **Dado** una cita ya agendada el lunes a las 9:00 y un solo veterinario, **entonces** las 9:00 no
   aparecen; con dos veterinarios y el otro libre, sí aparecen.
3. **Dado** un bloqueo (vacaciones) el miércoles, **entonces** ese miércoles no tiene horas.
4. **Dado** el día de hoy, **entonces** no se ofrecen horas que ya pasaron, y los días anteriores no
   se pueden elegir.
5. **Dado** que el tutor eligió día y hora, **cuando** avanza y luego vuelve o recarga, **entonces**
   siguen elegidos.
6. **Dado** una mascota de una especie que el aliado no atiende, **entonces** no se puede elegir.
7. **Dado** que se eligió un veterinario en particular, **entonces** solo se ven sus horas.

**Notas para quien implementa**

- El calendario existente consulta como máximo 31 días a la vez y devuelve cada hora con su
  veterinario. No se debe calcular la disponibilidad en la pantalla ni crear otro cálculo.

**DoD HU-029** (backlog)

- El calendario solo ofrece fechas y horas disponibles según los horarios del aliado.
- El sistema impide seleccionar fechas pasadas, espacios ocupados o intervalos no disponibles.
- La selección de fecha y hora se conserva al avanzar en el flujo de reserva.

**Además:** las horas se ven en hora de Colombia y coinciden con el horario que configuró el
aliado; DoD común (§2.9).

---

### HU-030 · Indicar el motivo de la cita

> Como tutor, quiero indicar el motivo de la cita en texto libre con límite de caracteres.

**Qué incluye:** el paso 3 de la reserva, guardar el motivo con la cita y mostrarlo.
**Qué no incluye:** adjuntos, editar el motivo después de reservar.
**Depende de:** un cambio en la base para guardar el motivo (migración común, §8). Se guarda al
confirmar (HU-031).

**Reglas**

1. **Obligatorio**, de 1 a **500 caracteres** (decisión D-02). Escribir solo espacios cuenta como
   vacío.
2. Debajo del campo hay un contador "120/500". Al llegar a 450 cambia de color para avisar. En 500
   no se puede escribir más; si se pega un texto más largo, se corta en 500 y se avisa "Se recortó
   el texto al límite de 500 caracteres".
3. Si está vacío: "Cuéntanos el motivo de la cita" y no se puede avanzar.
4. **Quién lo ve:** el tutor (en Mis citas) y el aliado y el veterinario asignado (en su agenda).
   No aparece en ninguna parte pública.
5. Es distinto del "motivo de consulta" que registra el veterinario en la consulta clínica
   (acuerdo A-15).

**Criterios de aceptación**

1. **Dado** un motivo de 500 caracteres con tildes y emojis, **entonces** se acepta y se guarda
   completo; con 501, no se puede.
2. **Dado** un motivo de solo espacios, **entonces** aparece el mensaje y no se avanza.
3. **Dado** un texto de 600 caracteres pegado, **entonces** queda en 500 con el aviso.
4. **Dado** una cita reservada, **entonces** el tutor ve su motivo en Mis citas y el aliado en su
   agenda, con los saltos de línea que escribió.
5. **Dado** otro tutor, **entonces** no puede ver ese motivo.

**DoD HU-030** (backlog)

- El formulario permite introducir el motivo en texto libre dentro del límite de caracteres
  definido.
- El sistema valida el límite y muestra el número o aviso correspondiente cuando se alcanza.
- El motivo válido se guarda asociado a la cita y se muestra al usuario autorizado.

**Además:** la pantalla, el servidor y la base cuentan los caracteres igual; DoD común (§2.9).

---

### HU-031 · Confirmar y reservar la cita

> Como tutor, quiero confirmar y/o reservar mi cita.

**Qué incluye:** el paso 4 (resumen y confirmación), crear la cita y la sección **Mis citas**
(lista y detalle) del tutor (acuerdo A-12).
**Qué no incluye:** pago; dirección para servicios a domicilio (decisión D-05); notificaciones
(HU-052); cancelar o reprogramar (HU-034).
**Depende de:** HU-029 y HU-030.

**Reglas**

1. **Resumen antes de confirmar:** mascota, servicio, aliado, lugar (sede con dirección o "A
   domicilio"), veterinario, fecha y hora, duración, precio para esa mascota y motivo. Cada dato
   tiene **Cambiar**, que lleva a su paso. Se avisa cómo se confirma: "Tu cita quedará confirmada"
   o "La clínica debe aceptar tu solicitud".
2. **Lo que decide el servidor, no la pantalla:** precio (el de la mascota, que queda fijo en la
   cita aunque luego cambien las reglas), hora de fin, estado y veterinario. Si alguien envía
   otros valores, se ignoran.
3. **Estado** (acuerdo A-11): queda **Agendada** si el aliado confirma automáticamente, o
   **Pendiente** si confirma manualmente. Mensaje final: "¡Tu cita quedó agendada!" o "Enviamos tu
   solicitud. Te avisaremos cuando la clínica la acepte".
4. **Sin duplicados:**
   - El botón **Confirmar** se deshabilita desde el primer clic.
   - Si llega dos veces la misma reserva (doble clic, reintento por mala conexión), se crea una sola
     cita y ambas veces se responde con esa misma cita.
   - Si otra persona tomó esa hora mientras tanto, se vuelve al calendario con "Ese horario acaba
     de ocuparse. Elige otro", conservando el día elegido.
5. **Validaciones al confirmar:** sesión de tutor, mascota propia, servicio todavía disponible,
   especie atendida, hora todavía libre y motivo válido. Si algo falla, se explica qué y no se crea
   la cita.
6. **Mis citas:** lista de las citas del tutor, las próximas primero y luego las pasadas, cada una
   con fecha y hora, mascota, servicio, aliado y estado. El detalle muestra todo lo del resumen, el
   estado actual y, cuando la cita se finalice, las recomendaciones (HU-033). Se entra desde el
   menú ("Mis citas", junto a "Mis mascotas") y al terminar la reserva.

**Criterios de aceptación**

1. **Dado** una reserva completa, **cuando** confirma, **entonces** se crea una cita con esa
   mascota, servicio, aliado, fecha, hora, veterinario, precio y motivo, y el tutor ve su detalle.
2. **Dado** un aliado con confirmación automática, **entonces** la cita queda Agendada; con
   confirmación manual, queda Pendiente, y el mensaje final corresponde.
3. **Dado** un doble clic o un reintento, **entonces** existe una sola cita.
4. **Dado** que otro tutor reservó la misma hora un instante antes, **entonces** el tutor vuelve a
   elegir hora con el aviso, y no se crea nada.
5. **Dado** que el aliado desactivó el servicio durante la reserva, **entonces** se informa que ya
   no está disponible y no se crea la cita.
6. **Dado** el resumen, **entonces** muestra todos los datos de la regla 1 y cada Cambiar lleva a su
   paso conservando lo demás.
7. **Dado** Mis citas, **entonces** el tutor solo ve sus propias citas, con el estado actual.

**Notas para quien implementa**

- La base ya impide duplicados y solapamientos y fija el estado inicial; el servidor debe usar lo
  que la base responde (incluido el estado) en lugar de repetir esas reglas.
- Al confirmar se debe volver a comprobar que la hora sigue en el calendario de HU-022.

**DoD HU-031** (backlog)

- La confirmación crea una reserva con mascota, servicio, aliado, fecha y hora seleccionados.
- Antes de confirmar se muestran los datos principales y se validan disponibilidad y campos
  requeridos.
- La reserva queda con el estado correcto y no se duplican citas ante doble clic o reintento.

**Además:** existe Mis citas para el tutor; DoD común (§2.9).

---

### HU-032 · Marcar la cita como finalizada o no asistió

> Como aliado, quiero marcar la cita como finalizada o no asistió (solo el aliado puede finalizar).

**Qué incluye:** la **agenda** del aliado (lista de sus citas) y las acciones **Finalizada** y **No
asistió**.
**Qué no incluye:** cancelar o reprogramar (HU-034), la consulta clínica (HU-037), avisar al tutor
(HU-054). Aceptar o rechazar citas pendientes está en duda (decisión D-01).
**Depende de:** HU-031 (que existan citas).

**Quién puede**

- El administrador de la clínica o el veterinario independiente: todas las citas de su agenda,
  desde su panel (nueva sección **Agenda** en `/panel/aliado`).
- Un veterinario de clínica: solo las citas asignadas a él, desde su panel (`/panel/veterinario`).
- Nadie más (ni el tutor ni otro aliado). La base ya aplica esta regla; el servidor también la
  aplica.

**Reglas**

1. **Agenda:** por defecto, hoy y los próximos 7 días, ordenada por hora; se puede cambiar el rango
   de fechas y filtrar por estado. Cada cita muestra hora, mascota (nombre y especie), tutor (solo
   el nombre), servicio, veterinario, motivo (HU-030) y estado.
2. **Cuándo se puede marcar:** solo citas **Agendadas** cuya hora de inicio ya llegó. Antes, en
   lugar de los botones se ve "Podrás marcarla desde las 9:30 a. m.". Una cita **Pendiente** no se
   puede finalizar (primero debe aceptarse).
3. **Estados finales:** Finalizada, No asistió y Cancelada no cambian más.
4. **Confirmación:** cada acción pide confirmar. "Finalizada" abre el cuadro de recomendaciones de
   HU-033 (acuerdo A-13); "No asistió" solo pide confirmar.
5. **Quién y cuándo:** la base registra automáticamente quién hizo el cambio y la fecha. El detalle
   de la cita en la agenda muestra ese historial: "Finalizada · por Dra. Pérez · 15 dic, 10:05 a. m.".
6. **Se refleja en:** la agenda (se vuelve a cargar), Mis citas del tutor (HU-031) y, cuando exista,
   el historial de la mascota (HU-011; ver §10).

**Criterios de aceptación**

1. **Dado** el administrador y una cita Agendada que ya empezó, **cuando** la marca Finalizada,
   **entonces** queda Finalizada y se registra quién y cuándo.
2. **Dado** un veterinario de la clínica con una cita asignada, **cuando** la marca No asistió,
   **entonces** queda No asistió con él como responsable.
3. **Dado** un veterinario de la clínica, **entonces** no ve ni puede marcar citas de otros
   veterinarios.
4. **Dado** un tutor u otro aliado, **cuando** intenta marcar la cita, **entonces** no puede y la
   cita no cambia.
5. **Dado** una cita Finalizada, **entonces** ya no se puede marcar No asistió.
6. **Dado** una cita que empieza mañana, **entonces** no se pueden marcar.
7. **Dado** una cita recién finalizada, **entonces** el tutor la ve como Finalizada en Mis citas.

**Notas para quien implementa**

- `/panel/aliado/page.tsx` ya tiene más de 2.000 líneas: la Agenda debe ir en un componente aparte
  que esa página solo importa (ver §8).
- La sección actual "Confirmación de citas" del panel es la configuración del modo de confirmación
  (HU-023); la Agenda es otra sección y no la reemplaza.

**DoD HU-032** (backlog)

- Solo un aliado autorizado puede marcar una cita como finalizada o como no asistió.
- El cambio de estado se guarda con fecha y responsable, y no permite transiciones no autorizadas.
- El estado actualizado se refleja en las vistas de citas e historial correspondientes.

**Además:** DoD común (§2.9).

---

### HU-033 · Escribir recomendaciones al cerrar la cita

> Como aliado, quiero escribir recomendaciones al cerrar la cita.

**Qué incluye:** el campo de recomendaciones en el cuadro de **Finalizada** de HU-032, y mostrarlas
al tutor.
**Qué no incluye:** editar las recomendaciones después (decisión D-06), recomendaciones en "No
asistió", adjuntos.
**Depende de:** HU-032 (misma acción, acuerdo A-13).

**Reglas**

1. **Opcionales**, hasta **2.000 caracteres**, con contador como el del motivo (HU-030).
2. Se guardan **en la misma acción** que marca la cita como Finalizada: o se guarda todo (estado y
   recomendaciones) o nada.
3. Si el guardado falla: el cuadro sigue abierto con el texto escrito, se ve el error y la cita
   sigue Agendada. El aviso "Cita finalizada" solo aparece cuando el servidor confirmó.
4. **Quién las ve:** el tutor, en el detalle de la cita en Mis citas (sección "Recomendaciones"), y
   el aliado y el veterinario en el detalle de la agenda. Si no hay, la sección no aparece.
5. Son de la cita, no de la consulta clínica (acuerdo A-15). El historial de la mascota (HU-011)
   las tomará de la cita cuando se implemente.

**Criterios de aceptación**

1. **Dado** recomendaciones escritas al finalizar, **entonces** la cita queda Finalizada y el tutor
   las ve en Mis citas, con sus saltos de línea.
2. **Dado** que se finaliza sin recomendaciones, **entonces** el tutor no ve una sección vacía.
3. **Dado** que el servidor falla, **entonces** el texto se conserva, se ve el error, no aparece
   "Cita finalizada" y la cita sigue Agendada.
4. **Dado** 2.001 caracteres, **entonces** no se pueden guardar.
5. **Dado** otro tutor, **entonces** no puede ver esas recomendaciones.

**DoD HU-033** (backlog)

- El aliado puede registrar y guardar recomendaciones vinculadas a la cita que está cerrando.
- Las recomendaciones quedan disponibles para consulta por el tutor autorizado.
- Si el guardado falla, se informa el error y no se muestra una confirmación falsa.

**Además:** DoD común (§2.9).

---

## 6. E08 · Compraventa de productos

**Producto visible** (acuerdo A-16): activo, no ocultado por moderación y de una tienda activa. Es
lo único que ve el tutor. Uno visible con stock 0 se muestra como **Agotado**.

---

### HU-044 · Crear, editar y desactivar productos

> Como aliado, quiero crear, editar y desactivar productos (nombre, categoría, precio, stock,
> descripción, fotos).

**Qué incluye:** la sección **Productos** del panel de la tienda (hoy dice "próximamente"): lista,
crear, editar, desactivar y reactivar.
**Qué no incluye:** borrar productos, variantes (tallas, sabores), carga masiva, moderación
(HU-066).
**Depende de:** nada nuevo (la base ya tiene productos y fotos; las fotos funcionan por enlace,
§2.7).

**Campos**

| Campo       | Regla                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| Nombre      | Obligatorio, 2 a 120 caracteres.                                               |
| Categoría   | Obligatoria. Las categorías del sistema (hoy: Alimentos, Accesorios, Higiene). |
| Precio      | Obligatorio, en pesos, sin decimales, mayor que 0.                             |
| Stock       | Obligatorio, número entero de 0 en adelante.                                   |
| Descripción | Opcional, hasta 2.000 caracteres.                                              |
| Fotos       | Opcionales, hasta 5 enlaces (§2.7). La primera es la portada.                  |

**Reglas**

1. Solo el administrador de una **tienda activa** gestiona productos, y solo los suyos.
2. Un producto nuevo queda **activo**.
3. **Desactivar** saca el producto de la tienda de inmediato y ya no se puede comprar. Se puede
   volver a **activar**. Un producto inactivo se puede editar.
4. **Nunca se borra** un producto: los pedidos anteriores conservan el producto y el precio al que
   se compró. Cambiar el precio no altera pedidos anteriores.
5. **Lista del panel:** portada, nombre, categoría, precio, stock y estado (Activo / Inactivo; y
   "Oculto por Veto" si moderación lo ocultó). Los más recientes primero. Se puede buscar por
   nombre y filtrar por estado.
6. Si se sale del formulario con cambios sin guardar, se pide confirmar.

**Criterios de aceptación**

1. **Dado** una tienda activa, **cuando** crea un producto válido con 3 fotos, **entonces** aparece en
   su lista y en la tienda pública, con la primera foto como portada.
2. **Dado** precio 0, stock negativo, stock con decimales o nombre vacío, **entonces** se ven los
   errores junto a cada campo y no se guarda.
3. **Dado** un producto, **cuando** cambia precio y stock, **entonces** la tienda muestra los valores
   nuevos y un pedido anterior conserva su precio.
4. **Dado** un producto desactivado, **entonces** no aparece en la tienda y su detalle dice que no
   está disponible; al reactivarlo, vuelve.
5. **Dado** una clínica o una tienda distinta, **entonces** no puede crear ni editar esos productos.
6. **Dado** un enlace de foto que no carga, **entonces** se marca ese enlace y los demás datos
   quedan como estaban.

**Notas para quien implementa**

- No existe todavía nada del módulo `comercio` en el servidor; esta historia lo inicia.
- Hace falta un endpoint público con las categorías de producto (como el de tipos de servicio).
- Las fotos de producto necesitan guardar su orden (migración común, §8).
- La sección Productos va en un componente aparte del panel (ver §8).

**DoD HU-044** (backlog)

- El aliado tienda puede crear, editar y desactivar productos con nombre, categoría, precio, stock,
  descripción y fotos.
- Se validan precio, stock y campos obligatorios; los cambios se guardan correctamente.
- Los productos desactivados no se ofrecen para compra y los pedidos históricos conservan su
  referencia.

**Además:** las fotos usan el mismo mecanismo de enlaces que las mascotas; DoD común (§2.9).

---

### HU-045 · Consultar productos por categoría y buscarlos

> Como tutor, quiero consultar productos por categoría y buscarlos.

**Qué incluye:** la tienda pública `/tienda` con productos reales: buscador, categorías, resultados y
paginación.
**Qué no incluye:** ordenar, filtrar por precio o por tienda, el carrito (HU-047).
**Depende de:** HU-044 (o productos de prueba).

**Reglas**

1. Solo productos visibles (acuerdo A-16).
2. **Texto:** la regla común de §2.3, sobre nombre, descripción y categoría.
3. **Categorías:** las del sistema, como opciones de selección única, más "Todas". Las categorías de
   ejemplo que hoy tiene la página (Alimento, Juguetes, Camas y hogar, Cuidado e higiene) **se
   reemplazan** por las reales.
4. Texto y categoría se combinan.
5. **Orden fijo:** con texto, los más parecidos primero; sin texto, por nombre.
6. **Tarjeta:** portada (o imagen genérica), nombre, precio, categoría y nombre de la tienda; "Agotado"
   si no hay stock. Lleva al detalle (HU-046).
7. **Sin resultados:** "No encontramos productos" con lo buscado y **Limpiar búsqueda**.
8. El buscador de la tienda busca en la tienda (hoy manda a `/buscar`; se corrige). `/tienda?q=…`
   también es el destino del enlace "Buscar en la tienda" de `/buscar` (acuerdo A-02).

**Criterios de aceptación**

1. **Dado** la categoría Alimentos, **entonces** solo hay alimentos.
2. **Dado** `CONCENTRADO gato` en Alimentos, **entonces** solo hay alimentos que contienen ambas
   palabras.
3. **Dado** un producto inactivo, ocultado o de una tienda suspendida, **entonces** no aparece.
4. **Dado** un producto sin stock, **entonces** aparece con "Agotado".
5. **Dado** una búsqueda sin coincidencias, **entonces** se ve el mensaje y Limpiar búsqueda devuelve
   todos los productos.
6. **Dado** un producto sin foto ni descripción, **entonces** la tarjeta no se rompe.

**DoD HU-045** (backlog)

- El tutor puede explorar productos por categoría y buscarlos por texto.
- Los resultados corresponden a productos activos y muestran la información principal disponible.
- La búsqueda y categoría pueden combinarse y se muestra un mensaje cuando no hay resultados.

**Además:** misma regla de texto y mismas piezas de filtro que la búsqueda de servicios; DoD común
(§2.9).

---

### HU-046 · Elegir un producto

> Como tutor, quiero elegir un producto.

**Qué incluye:** el detalle del producto (`/tienda/productos/[id]`), elegir la cantidad y **agregar
al carrito** (acuerdo A-17).
**Qué no incluye:** la pantalla del carrito, crear el pedido y descontar el stock (HU-047 en
adelante; la base ya descuenta el stock al crear el pedido).
**Depende de:** HU-045.

**Reglas**

1. **Detalle:** fotos (la portada primero), nombre, precio, categoría, descripción, tienda y
   disponibilidad:
   - Stock 0 → "Agotado" y no se puede agregar.
   - De 1 a 5 → "¡Quedan N!" (decisión D-08).
   - Más de 5 → "Disponible".
2. **Cantidad:** de 1 hasta lo que haya en stock (máximo 99).
3. **Al pulsar "Agregar al carrito"** se vuelve a consultar el producto en ese momento. Si ya no está
   visible: "Este producto ya no está disponible". Si la cantidad (más la que ya tenía en el
   carrito) supera el stock: "Solo quedan N unidades". En ambos casos no se agrega nada y la
   pantalla se actualiza.
4. **El carrito** se guarda en el navegador y es de **una sola tienda**, porque cada pedido es de
   una sola tienda. Si ya tiene productos de otra tienda, se pregunta "Tu carrito tiene productos
   de otra tienda. ¿Vaciarlo y agregar este?". Agregar un producto que ya estaba suma la cantidad.
   El carrito no guarda precios (se consultan siempre al servidor).
5. **No se necesita sesión para agregar** (decisión D-07); sí para comprar (HU-047).
6. Tras agregar: aviso "Agregado al carrito". El enlace "Ver carrito" lleva a una página provisional
   hasta que exista HU-047.
7. Un producto que no existe o ya no está visible muestra el estado "no existe" (§2.5).

**Criterios de aceptación**

1. **Dado** un producto con 3 unidades, **entonces** se ve "¡Quedan 3!" y no se pueden elegir más de 3.
2. **Dado** un producto agotado, **entonces** no se puede agregar.
3. **Dado** que el stock bajó mientras el tutor miraba, **cuando** agrega más de lo que queda,
   **entonces** ve "Solo quedan N unidades" y no se agrega nada.
4. **Dado** que la tienda desactivó el producto mientras el tutor miraba, **cuando** intenta
   agregarlo, **entonces** ve que ya no está disponible.
5. **Dado** un carrito con productos de la tienda A, **cuando** agrega uno de la tienda B,
   **entonces** se le pregunta si quiere vaciarlo; si cancela, el carrito no cambia.
6. **Dado** que agrega 2 y luego 1 del mismo producto, **entonces** el carrito tiene 3 (nunca más que
   el stock).

**Notas para quien implementa**

- El formato del carrito (qué tienda, qué productos y cuántos de cada uno) se define una vez en
  `@veto/shared` para que HU-047 lo lea igual.

**DoD HU-046** (backlog)

- El tutor puede seleccionar un producto activo y revisar la información necesaria para continuar.
- El sistema valida disponibilidad y stock antes de permitir añadirlo al flujo de compra.
- La selección corresponde al producto correcto y se informa si ya no está disponible.

**Además:** el formato del carrito queda documentado para HU-047; DoD común (§2.9).

---

## 7. E15–E16 · Adopción

**Ciclo de vida de una mascota en adopción** (único para HU-080, 082, 083 y 085, acuerdo A-19)

| Estado actual  | Puede pasar a                           | ¿Se ve en el catálogo? | ¿Se puede editar? |
| -------------- | --------------------------------------- | :--------------------: | :---------------: |
| **Disponible** | Pausada, En proceso, Adoptada, Retirada |           Sí           |        Sí         |
| **Pausada**    | Disponible ("Reanudar"), Retirada       |           No           |        Sí         |
| **En proceso** | Disponible, Adoptada, Retirada          |           No           |        Sí         |
| **Adoptada**   | — (final)                               |           No           |        No         |
| **Retirada**   | — (final)                               |           No           |        No         |

- Toda mascota nueva empieza **Disponible**.
- "Pausada" ya existe en el sistema aunque HU-083 no la nombre: es el estado que usa HU-082 para
  pausar.
- Se puede marcar Adoptada directamente desde Disponible, para adopciones que se cerraron fuera de
  la plataforma (decisión D-10).
- Pasar a **Adoptada** o **Retirada** pide confirmar con el aviso "Esta acción no se puede deshacer".
- Cada cambio puede llevar un motivo opcional y queda registrado con su fecha.
- **Solo las mascotas Disponibles de una fundación aprobada se ven en el catálogo** y pueden recibir
  solicitudes (acuerdo A-22).

**Dónde trabaja la fundación:** en su panel (`/panel/aliado`), que hoy solo muestra un mensaje. Se
agrega la sección **Mis mascotas** (listado HU-085, publicar HU-080, editar y estados HU-082/083,
fotos HU-084), en componentes aparte (ver §8). Si la fundación todavía no está aprobada (o fue
rechazada), la sección lo explica y no permite publicar: "Tu fundación debe estar aprobada por el
Equipo Veto para publicar mascotas".

---

### HU-080 · Publicar una mascota en adopción

> Como fundación, quiero publicar una mascota en adopción con sus datos obligatorios (nombre,
> especie, edad, sexo, tamaño, ubicación) y descripción (opcional).

**Qué incluye:** el formulario para publicar.
**Qué no incluye:** fotos y video (HU-084: se agregan justo después, en la misma pantalla, acuerdo
A-20). Cómo es la ubicación lo define HU-081 (acuerdo A-18).
**Depende de:** HU-081 (mismo formulario).

**Campos**

| Campo       | Regla                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| Nombre      | Obligatorio, hasta 60 caracteres.                                                             |
| Especie     | Obligatoria, del catálogo de especies.                                                        |
| Edad        | Obligatoria. Se escribe en años y meses (por ejemplo, 2 años y 3 meses) y se guarda en meses. |
| Sexo        | Obligatorio: Macho o Hembra.                                                                  |
| Tamaño      | Obligatorio: Pequeño, Mediano o Grande.                                                       |
| Ubicación   | Obligatoria: ciudad, y zona opcional (HU-081).                                                |
| Descripción | Opcional, hasta 2.000 caracteres.                                                             |

**Reglas**

1. Solo una fundación **aprobada** publica (la base también lo exige).
2. La mascota queda **Disponible** y aparece en el catálogo de inmediato.
3. Tras publicar: aviso "Mascota publicada" y se pasa a la pantalla de la mascota, con la sección de
   fotos lista para usar.

**Criterios de aceptación**

1. **Dado** una fundación aprobada y todos los datos obligatorios, sin descripción, **cuando**
   publica, **entonces** la mascota queda Disponible y aparece en el catálogo.
2. **Dado** que falta cualquiera de los seis datos obligatorios, **entonces** se ve el error junto a
   ese campo y no se publica.
3. **Dado** 2 años y 3 meses, **entonces** el catálogo muestra "2 años y 3 meses".
4. **Dado** una fundación pendiente o rechazada, **entonces** no puede publicar y ve el mensaje
   explicativo.
5. **Dado** una clínica, una tienda o un tutor, **entonces** no tiene esta opción.

**DoD HU-080** (backlog)

- La publicación exige nombre, especie, edad, sexo, tamaño y ubicación; la descripción puede
  omitirse.
- El sistema valida los campos obligatorios y guarda la publicación con un estado inicial coherente
  de disponibilidad.
- La mascota publicada aparece en el catálogo público únicamente cuando la fundación está autorizada
  y la publicación está activa.

**Además:** el mismo formulario y las mismas validaciones sirven para editar (HU-082); DoD común
(§2.9).

---

### HU-081 · Indicar la ubicación sin revelar la dirección ni la fundación

> Como fundación, quiero indicar la ubicación de la mascota (ciudad o zona) sin revelar la dirección
> ni la fundación.

**Qué incluye:** los campos de ubicación, sus validaciones, cómo se muestran y la prueba de que no se
filtra información de la fundación (acuerdo A-21).
**Qué no incluye:** mapas.
**Depende de:** un cambio en la base para guardar ciudad y zona por separado (migración común, §8).

**Reglas**

1. **Ciudad:** obligatoria. **Zona** (barrio, localidad o sector): opcional, hasta 60 caracteres.
2. La zona **no puede ser una dirección**: se rechaza si tiene "#" o un tipo de vía seguido de un
   número (calle, cl, carrera, cra, kr, avenida, av, diagonal, dg, transversal, tv). Mensaje:
   "Indica solo el barrio o la zona, no la dirección".
3. Junto a la ubicación y la descripción se avisa: "No incluyas la dirección ni el nombre de la
   fundación: esta información es pública".
4. **Siempre se muestra igual**, en tarjetas y en detalle: "Chapinero, Bogotá" o solo "Bogotá".
5. La dirección y la ciudad registradas de la fundación nunca se usan para la mascota, ni se
   proponen por defecto.
6. La privacidad de §2.8 se comprueba aquí con una prueba automática que recorre todo lo público de
   adopción.

**Criterios de aceptación**

1. **Dado** Bogotá y Chapinero, **entonces** la tarjeta y el detalle muestran "Chapinero, Bogotá".
2. **Dado** la zona "Calle 45 # 12-30" o "Cra 7 85", **entonces** se rechaza con el mensaje.
3. **Dado** una fundación de prueba con nombre y dirección reconocibles, **cuando** se revisan todas
   las respuestas públicas de adopción (catálogo con cada filtro y detalle), **entonces** ninguna
   contiene su nombre, dirección, contacto, logo ni identificador.

**DoD HU-081** (backlog)

- La ubicación pública muestra solo ciudad o zona y no expone dirección exacta ni identidad de la
  fundación.
- La ubicación se presenta de forma consistente en las tarjetas y en el detalle de la mascota.
- Las pruebas con datos de ejemplo confirman que no se filtran dirección privada ni datos
  identificadores de la fundación.

**Además:** la prueba de privacidad queda en la suite automática y cubre lo que se agregue después;
DoD común (§2.9).

---

### HU-082 · Editar, pausar y retirar publicaciones

> Como fundación, quiero editar, pausar y retirar publicaciones.

**Qué incluye:** editar los datos de una mascota y los botones rápidos **Pausar**, **Reanudar** y
**Retirar**.
**Qué no incluye:** borrar (no existe: se retira).
**Depende de:** HU-080 y el ciclo de estados de esta sección.

**Reglas**

1. Se editan los mismos datos de HU-080, con las mismas validaciones, mientras la mascota esté
   Disponible, Pausada o En proceso. Adoptada o Retirada se ven solo para consulta.
2. Botones según el estado: Disponible → Pausar, Retirar · Pausada → Reanudar, Retirar · En proceso
   → Retirar. Son atajos del mismo cambio de estado de HU-083 (acuerdo A-19).
3. Pausar o retirar saca a la mascota del catálogo de inmediato; reanudar la devuelve.
4. Solo la fundación dueña de la mascota.

**Criterios de aceptación**

1. **Dado** una mascota Disponible, **cuando** cambia la descripción y el tamaño, **entonces** el
   catálogo muestra los datos nuevos.
2. **Dado** un dato obligatorio vacío al editar, **entonces** no se guarda.
3. **Cuando** la pausa, **entonces** desaparece del catálogo; al reanudar, vuelve.
4. **Cuando** la retira (confirmando), **entonces** desaparece del catálogo y ya no se puede editar
   ni reanudar.
5. **Dado** otra fundación, **entonces** no puede editar ni cambiar el estado.

**DoD HU-082** (backlog)

- La fundación puede editar los datos permitidos y guardar los cambios con validación de campos.
- Puede pausar y retirar una publicación, y cada acción actualiza su visibilidad en el catálogo.
- Una publicación pausada o retirada no aparece como disponible en el catálogo público.

**Además:** DoD común (§2.9).

---

### HU-083 · Gestionar el estado de cada mascota

> Como fundación, quiero gestionar el estado de cada mascota: disponible, en proceso, adoptada,
> retirada.

**Qué incluye:** el selector **Cambiar estado** en la pantalla de la mascota y en cada fila del
listado (HU-085), y el historial de cambios.
**Qué no incluye:** cambios automáticos por solicitudes de adopción (HU-093 y 094, siguientes
sprints).
**Depende de:** HU-080.

**Reglas**

1. El selector solo ofrece los cambios permitidos desde el estado actual (tabla de esta sección). En
   Adoptada o Retirada no aparece.
2. Se puede escribir un motivo opcional.
3. La pantalla de la mascota muestra su historial: "En proceso · 15 dic, 3:20 p. m. · Motivo: …".
4. El estado se ve igual (texto y color) en el listado, en la pantalla de la mascota y en los
   filtros.
5. La regla también la aplica la base, para que no se pueda saltar desde otra parte.

**Criterios de aceptación**

1. **Dado** una mascota Disponible, **cuando** la pasa a En proceso, **entonces** el panel la muestra
   En proceso y el catálogo deja de mostrarla.
2. **Dado** En proceso, **cuando** la pasa a Adoptada (confirmando), **entonces** ya no puede cambiar.
3. **Dado** un cambio no permitido (por ejemplo, de Adoptada a Disponible, o de Pausada a En
   proceso), **entonces** se rechaza y el estado no cambia.
4. **Dado** varios cambios, **entonces** el historial los muestra en orden, con fecha y motivo.

**DoD HU-083** (backlog)

- La fundación puede cambiar el estado entre disponible, en proceso, adoptada y retirada según las
  reglas del flujo.
- El estado actualizado se conserva y se refleja tanto en el listado de la fundación como en el
  catálogo público.
- Las mascotas no disponibles dejan de mostrarse como disponibles para nuevas solicitudes de
  adopción.

**Además:** hay una prueba que confirma que la pantalla y la base permiten exactamente los mismos
cambios; DoD común (§2.9).

---

### HU-084 · Cargar varias fotos y, opcionalmente, un video

> Como fundación, quiero cargar varias fotos (y opcionalmente video) por mascota.

**Qué incluye:** la sección "Fotos y video" en la pantalla de la mascota.
**Qué no incluye:** subir archivos (se usan enlaces, §2.7) ni editar imágenes.
**Depende de:** HU-080 y un cambio en la base para guardar varias fotos y el video (hoy hay una sola
foto; migración común, §8).

**Reglas**

1. Hasta **5 fotos** (enlaces, con vista previa) y **1 video** opcional (decisión D-09): un enlace de
   YouTube o un enlace directo a un video MP4 o WebM.
2. La fundación ordena las fotos (subir y bajar, también con teclado). **La primera es la portada**
   del catálogo; en el detalle, el video se muestra después de las fotos.
3. Un enlace que no carga o con formato no admitido se marca con su error ("El enlace no es una
   imagen", "Ya tiene 5 fotos", "Ese enlace de video no es compatible") y no se guarda; los demás
   sí, y los datos de la mascota no cambian.
4. Solo se cambian fotos y video mientras la mascota se pueda editar (no en Adoptada ni Retirada).

**Criterios de aceptación**

1. **Dado** 4 fotos reordenadas, **entonces** el catálogo usa como portada la nueva primera y el
   detalle las muestra en ese orden.
2. **Dado** un enlace de YouTube, **entonces** el video se ve en el detalle; un segundo video se
   rechaza.
3. **Dado** 3 enlaces y uno no carga, **entonces** se guardan 2, el otro muestra su error y la
   mascota sigue intacta.
4. **Dado** una sexta foto, **entonces** se rechaza.
5. **Dado** una mascota sin fotos, **entonces** el catálogo y el detalle usan la imagen genérica.

**DoD HU-084** (backlog)

- La fundación puede adjuntar varias fotos a una mascota y el sistema valida formatos y límites de
  carga configurados.
- Las imágenes cargadas se almacenan y se muestran correctamente en el orden definido por la
  interfaz.
- Si se habilita video, se valida su formato y tamaño; si falla una carga, se informa el error sin
  corromper la publicación.

**Además:** el mismo componente de fotos por enlace que las mascotas y los productos; DoD común
(§2.9).

---

### HU-085 · Ver el listado de mis mascotas con filtro por estado

> Como fundación, quiero ver el listado de mis mascotas con filtros por estado.

**Qué incluye:** el listado de la sección Mis mascotas del panel.
**Qué no incluye:** buscar por texto u otros filtros en el panel.
**Depende de:** HU-080.

**Reglas**

1. Solo las mascotas de la fundación que inició sesión.
2. **Filtro por estado** como pestañas: Todas + los cinco estados, cada una con su cantidad
   ("Disponibles (4)").
3. Cada fila: portada, nombre, especie, edad, estado, fecha de publicación y acciones (**Editar**,
   **Cambiar estado**). Las más recientes primero.
4. **Vacío:** sin mascotas → "Todavía no has publicado mascotas" y **Publicar mascota**; con filtro →
   "No tienes mascotas en estado …" y **Ver todas**.
5. Tras un cambio de estado desde la fila, el listado y las cantidades se actualizan de inmediato (si
   la mascota ya no corresponde a la pestaña, sale de ella).

**Criterios de aceptación**

1. **Dado** dos fundaciones, **entonces** cada una ve solo sus mascotas.
2. **Dado** la pestaña Pausadas, **entonces** solo hay pausadas y la cantidad coincide con las filas.
3. **Dado** que pausa una mascota desde la pestaña Disponibles, **entonces** sale de esa pestaña y las
   cantidades se actualizan sin recargar.
4. **Dado** una fundación sin mascotas, **entonces** ve el estado vacío con Publicar mascota.

**DoD HU-085** (backlog)

- La fundación ve únicamente las mascotas asociadas a su cuenta.
- El listado muestra el estado de cada mascota y permite filtrar por estado.
- Los filtros producen resultados correctos y el listado refleja los cambios recientes de
  publicación y estado.

**Además:** DoD común (§2.9).

---

### HU-086 · Acceder a la sección Adopción desde el inicio y el menú

> Como tutor, quiero acceder a la sección "Adopción" desde el inicio y el menú principal.

**Qué incluye:** comprobar y completar los accesos que **ya existen**: la tarjeta Adopción del
inicio, el enlace del menú superior (también en celular) y el del pie de página.
**Qué no incluye:** el contenido de `/adopcion` (HU-087 a 089).
**Depende de:** nada.

**Reglas**

1. La sección es pública y el enlace se ve con cualquier tipo de sesión o sin sesión (acuerdo A-01).
2. Todos los accesos llevan a `/adopcion`.
3. El enlace del menú se marca como activo en `/adopcion` **y también** en el detalle de una mascota
   (hoy solo se marca en la ruta exacta).
4. En celular, el menú se abre con su botón, muestra Adopción, se cierra al elegir un enlace y con la
   tecla Escape.

**Criterios de aceptación**

1. **Dado** el inicio, **cuando** pulsa la tarjeta Adopción o el enlace del menú, **entonces** llega a
   `/adopcion`.
2. **Dado** `/adopcion` abierta directamente o recargada, **entonces** carga bien y el menú la marca
   como activa; lo mismo en el detalle de una mascota.
3. **Dado** un celular, **entonces** el menú muestra Adopción y se puede usar con teclado.
4. **Dado** un visitante sin sesión o un aliado, **entonces** también ve el enlace.

**DoD HU-086** (backlog)

- La sección Adopción está disponible desde la pantalla de inicio y el menú principal para los roles
  autorizados.
- Los enlaces de acceso llevan a la misma sección y funcionan en navegación directa y al recargar la
  página.
- La sección mantiene los patrones de navegación y accesibilidad utilizados por el resto de la
  aplicación.

**Además:** quien tome esta historia es responsable del menú superior en el sprint; las demás
historias que necesiten un enlace nuevo (Veterinarias en HU-024, Mis citas en HU-031) se coordinan
con esa persona (§8). DoD común (§2.9).

---

### HU-087 · Ver el catálogo de mascotas en adopción en tarjetas

> Como tutor, quiero ver el catálogo de mascotas en adopción en tarjetas (foto, nombre, especie, edad,
> sexo y ubicación), sin mostrar la fundación.

**Qué incluye:** el catálogo en `/adopcion`. La parte de presentación actual de la página se puede
conservar arriba; el aviso "Estamos conectando con fundaciones" se reemplaza por el catálogo.
**Qué no incluye:** favoritos, compartir, filtros (HU-088).
**Depende de:** HU-080 (o datos de prueba) y la privacidad de §2.8.

**Reglas**

1. Solo mascotas Disponibles de fundaciones aprobadas (acuerdo A-22). Las más recientes primero.
2. **Tarjeta:** portada (HU-084), nombre, especie, edad, sexo y ubicación (HU-081). Toda la tarjeta
   lleva al detalle (HU-089).
3. Sin foto, o si no carga → imagen genérica con el mismo tamaño. Un nombre muy largo se corta con
   "…".
4. Nada de la fundación (§2.8).
5. **Vacío:** "Por ahora no hay mascotas en adopción. Vuelve pronto."

**Criterios de aceptación**

1. **Dado** mascotas Disponibles, **entonces** se ven en tarjetas con foto, nombre, especie, edad,
   sexo y ubicación.
2. **Dado** mascotas Pausadas, En proceso, Adoptadas o Retiradas, o de una fundación no aprobada,
   **entonces** no aparecen.
3. **Dado** cualquier tarjeta, **entonces** no hay nada de la fundación (lo confirma la prueba de
   HU-081).
4. **Dado** una mascota sin foto o con un nombre muy largo, **entonces** la grilla conserva su diseño.
5. **Dado** más de 20 mascotas, **entonces** hay paginación.

**DoD HU-087** (backlog)

- El catálogo muestra tarjetas con foto, nombre, especie, edad, sexo y ubicación para las mascotas
  publicadas y disponibles.
- La tarjeta no muestra el nombre, dirección ni otros datos que identifiquen a la fundación.
- Cuando faltan datos opcionales o imágenes, se presenta un valor alternativo adecuado sin romper el
  diseño.

**Además:** DoD común (§2.9).

---

### HU-088 · Filtrar por tipo de mascota, edad, tamaño y ubicación

> Como tutor, quiero filtrar por tipo de mascota, edad, tamaño y ubicación.

**Qué incluye:** los filtros del catálogo de adopción, con las mismas piezas de HU-026 (acuerdo
A-06).
**Qué no incluye:** filtro por sexo, ordenar.
**Depende de:** HU-087 y las piezas de filtros de HU-026.

**Filtros**

| Filtro          | Opciones                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Tipo de mascota | Las especies del catálogo del sistema.                                                                        |
| Edad            | Cachorro (menos de 1 año) · Joven (1 a 2 años) · Adulto (3 a 7 años) · Senior (8 años o más) (decisión D-11). |
| Tamaño          | Pequeño · Mediano · Grande.                                                                                   |
| Ubicación       | Ciudad, con la regla de §2.4.                                                                                 |

**Reglas**

1. Se combinan entre sí; un valor por filtro; la URL los guarda (§2.2).
2. Etiquetas de filtros activos y **Quitar filtros**, igual que en la búsqueda de servicios.
3. **Sin resultados con filtros:** "No hay mascotas con estos filtros" y **Quitar filtros**.

**Criterios de aceptación**

1. **Dado** Gato + Pequeño, **entonces** solo hay gatos pequeños.
2. **Dado** Joven, **entonces** todas tienen de 1 a 2 años (una de 11 meses o de 3 años no aparece).
3. **Dado** una ciudad sin mascotas, **entonces** se ve el estado vacío y Quitar filtros devuelve todo
   el catálogo.
4. **Cuando** se cambia o quita un filtro, **entonces** los resultados se actualizan y al recargar se
   conservan.

**DoD HU-088** (backlog)

- Los filtros por tipo de mascota, edad, tamaño y ubicación pueden combinarse y aplicarse a los
  resultados.
- Los resultados coinciden con los filtros seleccionados y se actualizan al modificar o limpiar los
  filtros.
- Cuando no hay coincidencias, se muestra un mensaje de estado vacío y una forma clara de restablecer
  la búsqueda.

**Además:** DoD común (§2.9).

---

### HU-089 · Ver el detalle de la mascota en adopción

> Como tutor, quiero ver el detalle de la mascota en adopción si los hay

**Qué incluye:** el detalle `/adopcion/[id]`.
**Qué no incluye:** el formulario de solicitud de adopción (HU-090, siguiente sprint).
**Depende de:** HU-087 y HU-084 (galería).

**Reglas**

1. Muestra: galería con todas las fotos y el video (HU-084), nombre, especie, edad, sexo, tamaño,
   ubicación y descripción (si no hay descripción, esa sección no aparece).
2. Botón **Quiero adoptar**: hasta que exista HU-090, lleva a una página provisional.
3. Si la mascota no existe o ya no está Disponible: "Esta mascota ya no está disponible para
   adopción" y **Ver otras mascotas**. Nunca se muestran datos viejos de una mascota que ya no está
   disponible, y no se distingue entre "no existe" y "ya no está disponible".
4. "Volver al catálogo" conserva los filtros y la página de donde venía.
5. Nada de la fundación (§2.8).

**Criterios de aceptación**

1. **Dado** una mascota Disponible con 3 fotos y un video, **cuando** se abre su tarjeta, **entonces**
   se ve su detalle completo con la galería en orden.
2. **Dado** el detalle, **entonces** no hay nada de la fundación.
3. **Dado** que la mascota se pausó mientras el tutor tenía abierto el catálogo, **cuando** abre su
   detalle, **entonces** ve el mensaje de no disponible.
4. **Dado** un enlace inexistente, **entonces** ve el mismo mensaje, sin errores.
5. **Dado** una mascota sin descripción ni fotos, **entonces** el detalle no muestra secciones vacías.

**DoD HU-089** (backlog)

- Al seleccionar una mascota, se abre su detalle con la información disponible y las imágenes
  asociadas.
- El detalle respeta la anonimización: no revela la identidad ni la dirección privada de la
  fundación.
- Si la publicación deja de estar disponible o el identificador no existe, se muestra un estado
  informativo y no datos incorrectos.

**Además:** DoD común (§2.9).

---

## 8. Orden de trabajo y coordinación

### 8.1 Antes de empezar (primer día)

1. **Zona horaria** (§10): confirmar que el sistema interpreta los horarios en hora de Colombia.
   Bloquea HU-029 a 033.
2. **Una sola migración común** de base de datos, a cargo de una sola persona y numerada **0011**
   (la última es la 0010; ojo, ya hay dos 0003 y dos 0007). Contiene:
   - búsqueda sin tildes (HU-025, 045);
   - precio con datos sueltos y precio "desde" (HU-026, 027, 028);
   - motivo de la cita (HU-030) y límite de las recomendaciones (HU-033);
   - orden de las fotos de producto (HU-044);
   - ciudad y zona de la mascota en adopción, varias fotos y video, y el ciclo de estados (HU-081,
     083, 084), actualizando la vista pública del catálogo sin agregarle datos de la fundación.

   Si después una historia necesita otro cambio, toma el siguiente número libre y lo avisa al
   equipo.

3. **Datos de prueba:** hoy no hay ninguno (`db/seeds/` está vacío). Conviene un script con clínicas,
   un veterinario independiente, servicios con y sin reglas de precio, horarios, una tienda con
   productos (uno agotado y uno inactivo), fundaciones (una aprobada y una pendiente, con nombre y
   dirección reconocibles para la prueba de HU-081) y mascotas en adopción en todos los estados.

### 8.2 Cuatro frentes que casi no se tocan

| Frente   | Historias, en orden                                          | Necesita de otro frente     |
| -------- | ------------------------------------------------------------ | --------------------------- |
| Búsqueda | HU-025 → 026 → 027 → 024 → 028                               | —                           |
| Citas    | HU-029 → 030 → 031 → 032 → 033                               | HU-028 (botón Reservar)     |
| Tienda   | HU-044 → 045 → 046                                           | Piezas de filtros de HU-026 |
| Adopción | HU-086 → 080 + 081 → 084 → 082 + 083 → 085 → 087 → 088 → 089 | Piezas de filtros de HU-026 |

### 8.3 Archivos que tocan varias historias

| Archivo                                                      | Acuerdo                                                                                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/web/src/app/panel/aliado/page.tsx`                 | Ya tiene más de 2.000 líneas. Cada sección nueva (Agenda, Productos, Mis mascotas) va en **su propio componente**; la página solo lo importa y agrega su entrada al menú del panel. |
| `frontend/web/src/components/SiteChrome.tsx` (menú superior) | Responsable: quien tome HU-086. HU-024 (Veterinarias) y HU-031 (Mis citas) le piden sus enlaces.                                                                                    |
| `packages/shared/src/index.ts`                               | Cada historia crea su propio archivo de esquemas y solo agrega su línea de exportación.                                                                                             |
| `db/migrations/`                                             | Ver 8.1.                                                                                                                                                                            |
| `apps/api/src/modules/README.md`                             | Cada historia agrega su sección corta con los endpoints nuevos, como se hizo en el sprint 1.                                                                                        |

---

## 9. Decisiones a confirmar con el PO

Se tomó una opción por defecto para no bloquear el sprint. Si el PO decide otra cosa, se ajusta este
documento **antes** de implementar.

| #    | Tema                                            | Opción por defecto                                                                                                                                                                        | Historias |
| ---- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D-01 | Aceptar o rechazar citas pendientes             | **Recomendado incluirlo en HU-032** (botones Aceptar / Rechazar en la Agenda). Quedó pendiente de HU-023; sin esto, los aliados con confirmación manual no pueden finalizar ninguna cita. | 023, 032  |
| D-02 | Motivo de la cita                               | Obligatorio, de 1 a 500 caracteres.                                                                                                                                                       | 030       |
| D-03 | Edad y peso en la búsqueda de servicios         | Calculan el precio para esa mascota; no quitan servicios por sí solos.                                                                                                                    | 026, 027  |
| D-04 | Ubicación de los servicios a domicilio          | Se asume que el aliado va a domicilio en las ciudades de sus sedes o, sin sedes, en su ciudad de registro.                                                                                | 026       |
| D-05 | Dirección para servicios a domicilio            | No se pide en este sprint (el sistema no la guarda).                                                                                                                                      | 031       |
| D-06 | Editar las recomendaciones después de finalizar | No se permite.                                                                                                                                                                            | 033       |
| D-07 | Agregar al carrito sin sesión                   | Se permite; la sesión se pide al comprar.                                                                                                                                                 | 046       |
| D-08 | Mostrar el stock exacto                         | Solo cuando quedan 5 o menos.                                                                                                                                                             | 046       |
| D-09 | Video de la mascota en adopción                 | Un enlace de YouTube o de un archivo MP4/WebM.                                                                                                                                            | 084       |
| D-10 | Pasar de Disponible a Adoptada directamente     | Se permite.                                                                                                                                                                               | 083       |
| D-11 | Rangos de edad en adopción                      | Cachorro (menos de 1 año), Joven (1 a 2), Adulto (3 a 7), Senior (8 o más).                                                                                                               | 088       |
| D-12 | Límites de fotos                                | 5 por producto y 5 por mascota en adopción, igual que las mascotas del tutor.                                                                                                             | 044, 084  |
| D-13 | Servicios de aliados sin especies configuradas  | No aparecen en la búsqueda (nadie podría reservarlos).                                                                                                                                    | 025, 026  |

---

## 10. Hallazgos del sprint 1 que afectan este sprint

| Hallazgo                                                                                                                                                                                                                      | Afecta a         | Qué hacer                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Zona horaria.** Las horas del horario se interpretan en la zona horaria de la base, y la conexión no la fija. Si la base está en UTC (lo normal en Supabase), un horario de 8:00 se ofrecería a las 3:00 a. m. de Colombia. | HU-029 a 033     | Fijar la zona horaria de Colombia en la base o en la conexión, y probarlo antes de empezar las citas.                |
| **Volver después de ingresar.** La ficha de la clínica manda a `/ingresar?returnTo=…`, pero la pantalla de ingreso ignora ese dato.                                                                                           | HU-028, 029      | Corregirlo en HU-028 (regla 3).                                                                                      |
| **Migraciones con número repetido** (dos 0003 y dos 0007).                                                                                                                                                                    | Migración común  | Usar 0011 en adelante y coordinar cada número.                                                                       |
| **Estado inicial de los aliados.** El registro deja activos de inmediato a clínicas, veterinarios y tiendas (solo las fundaciones quedan pendientes), pero el README de los módulos dice que quedan pendientes.               | Búsqueda, tienda | Confirmar cuál es la regla; define qué aliados aparecen en búsquedas y en la tienda.                                 |
| **Categorías de la tienda.** La página de la tienda muestra categorías de ejemplo distintas de las de la base.                                                                                                                | HU-045           | Reemplazarlas por las reales (HU-045, regla 3).                                                                      |
| **Historial de la mascota (HU-011)** no está implementado.                                                                                                                                                                    | HU-032, 033      | Este sprint refleja los cambios en Mis citas. Cuando se haga HU-011, debe tomar estado y recomendaciones de la cita. |
| **Sedes de la tienda.** El panel de la tienda muestra la sección Sedes, pero el servidor solo permite sedes a las clínicas.                                                                                                   | —                | Revisarlo aparte; no bloquea este sprint.                                                                            |
| **Sin datos de prueba** (`db/seeds/` vacío).                                                                                                                                                                                  | Todas            | Ver 8.1.                                                                                                             |
