# Frontend de Veto

Inventario de las aplicaciones de interfaz y su integración actual con la API. Esta guía describe el código encontrado en `frontend/web/` y `frontend/figma/`; no implica que una pantalla visual tenga toda su funcionalidad de producto conectada.

> La aplicación de producción es `frontend/web/`. `frontend/figma/` es un prototipo visual Figma Make, no una segunda aplicación de producción. Para contratos HTTP, parámetros, permisos y respuestas, consultar [`api-backend.md`](./api-backend.md), que debe contrastarse con los controladores actuales cuando cambie la API.

## 1. Aplicaciones y tecnologías

| Aplicación                        | Ruta                  | Tecnología                                                  | Uso                                                                                                |
| --------------------------------- | --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Web de producción                 | `frontend/web/`       | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 | Aplicación web desplegable que consume la API NestJS.                                              |
| Prototipo Figma Make              | `frontend/figma/`     | Vite 8, React 19, TypeScript, Tailwind CSS 4                | Vista de exploración visual y componentes de referencia; no debe confundirse con la web funcional. |
| Recursos compartidos del frontend | `frontend/resources/` | Imágenes estáticas                                          | Recursos de mascotas usados por la interfaz cuando se importan explícitamente.                     |

El workspace usa pnpm. Los paquetes y versiones se declaran en los `package.json` de cada aplicación y en la raíz. La web usa alias `@/*` hacia `frontend/web/src/*`; el prototipo no comparte componentes de ejecución con Next.js.

## 2. Estructura de la web de producción

| Ruta                               | Responsabilidad                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `frontend/web/src/app/`            | Rutas, layouts y Route Handlers de Next App Router.                           |
| `frontend/web/src/components/`     | Chrome del sitio, controles compartidos, marca y componentes de presentación. |
| `frontend/web/src/lib/api.ts`      | Cliente HTTP para la API y normalización de errores.                          |
| `frontend/web/src/lib/session.ts`  | Notificación de cambios de sesión dentro de la pestaña.                       |
| `frontend/web/src/lib/errores.ts`  | Conversión de errores Zod a errores asociados a campos.                       |
| `frontend/web/src/app/globals.css` | Tokens de marca, estilos globales, componentes y reglas responsive.           |
| `frontend/web/public/`             | Logo, imágenes de especies y otros archivos servidos estáticamente.           |
| `frontend/web/test/`               | Pruebas Vitest de utilidades y componentes web.                               |

`src/app/layout.tsx` define el documento HTML en español, metadatos globales y envuelve las páginas con `SiteChrome`. Las páginas bajo `/panel/*` y `/equipo-veto/*` omiten el encabezado y pie públicos desde `SiteChrome`; cada panel dibuja su propio marco.

## 3. Rutas de la aplicación web

La tabla describe la implementación observada, no el alcance completo que pudiera proponer el backlog.

| Ruta                       | Pantalla y estado funcional observado                                                                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                        | Inicio de tutor con formulario de búsqueda y enlaces a catálogos/servicios. El contenido principal es estático; el formulario navega a `/buscar`.                                                                                                                                        |
| `/buscar`                  | Lee `q` y `ubicacion` de la URL y presenta una pantalla de búsqueda/sugerencias. Actualmente no consulta ni muestra resultados de búsqueda de la API.                                                                                                                                    |
| `/clinicas`                | Consulta `GET /api/aliados/clinicas`; presenta carga, error, vacío y tarjetas con enlace al detalle.                                                                                                                                                                                     |
| `/clinicas/[clinicaId]`    | Consulta datos públicos de veterinarios, sedes, especies, servicios y confirmación de la clínica. Permite filtrar servicios por especie mediante query string. Ofrece enlace de acceso para continuar a reserva; verificar el código y la API para el flujo concreto antes de ampliarlo. |
| `/veterinarios`            | Página informativa/visual; indica que por ahora se puede encontrar profesionales desde clínicas. No consulta un directorio de veterinarios independientes.                                                                                                                               |
| `/tienda`                  | Página informativa/visual de categorías y preparación de tienda. No consulta productos ni categorías de la API en esta ruta.                                                                                                                                                             |
| `/adopcion`                | Página informativa/visual sobre adopción. No consulta actualmente `GET /api/adopciones/catalogo`.                                                                                                                                                                                        |
| `/mascotas`                | Gestión de mascotas del tutor: carga catálogo de especies y mascotas, y ofrece creación/edición y gestión de fotos con sesión.                                                                                                                                                           |
| `/ingresar`                | Inicio de sesión por credenciales, pasos de 2FA y finalización/vinculación/registro de Google. El login Google comienza como navegación del navegador.                                                                                                                                   |
| `/registro`                | Registro de tutor mediante la API.                                                                                                                                                                                                                                                       |
| `/registro/aliado`         | Registro de aliado y manejo de respuesta/estado de solicitud.                                                                                                                                                                                                                            |
| `/recuperar-contrasena`    | Flujo por código de correo: consulta disponibilidad, solicita y verifica código y restablece contraseña.                                                                                                                                                                                 |
| `/perfil`                  | Consulta y edición de perfil, gestión de 2FA, estado de vinculación Google y eliminación de cuenta.                                                                                                                                                                                      |
| `/panel/aliado`            | Panel de gestión para aliados y personal veterinario asociado: según el rol consulta/gestiona servicios, sedes, veterinarios, especies atendidas, horarios, reglas de precio y modo de confirmación. Requiere contrastar cada operación con la API y el rol.                             |
| `/panel/veterinario`       | Panel del veterinario autenticado con perfil y consultas paginadas/filtrables.                                                                                                                                                                                                           |
| `/equipo-veto/fundaciones` | Interfaz administrativa para revisar solicitudes de fundación.                                                                                                                                                                                                                           |
| `/componentes`             | Página de catálogo/documentación visual de componentes; no es un flujo de negocio.                                                                                                                                                                                                       |
| `/api/auth/logout`         | Route Handler de Next que emite una cookie `veto_session` expirada en la respuesta del origen web; no llama al backend. No es una ruta visual.                                                                                                                                           |
| `/api/photos/resolve`      | Route Handler de Next para resolver imágenes remotas y responder desde la web. Revisar sus validaciones antes de cambiar su política de URL.                                                                                                                                             |

La navegación directa y la recarga dependen del enrutamiento App Router. Rutas con parámetros o query strings deben conservar dichos parámetros al construir enlaces; no se deben inferir filtros, permisos ni resultados solo por el contenido del formulario.

## 4. Integración con la API

### Cliente HTTP común

`frontend/web/src/lib/api.ts` exporta `API_URL`, `ApiError` y `api<T>()`.

- La URL base viene de `NEXT_PUBLIC_API_URL`; si no está definida en el bundle, el valor por defecto actual es `http://localhost:3001/api`.
- Las páginas pasan rutas relativas al prefijo `/api`, por ejemplo `api('/identidad/me')`.
- El cliente incluye `credentials: 'include'`, `Content-Type: application/json` y `cache: 'no-store'`.
- Las respuestas `204` se convierten en `undefined`; las demás respuestas correctas se leen como JSON.
- En respuestas no exitosas lanza `ApiError`, que expone `status` y `fieldErrors`. Intenta interpretar `message`, `errores` y `errors` de la API; si el cuerpo no es JSON conserva el texto recibido.
- Solicitudes de OAuth que son navegación/redirect deben seguir siendo navegación del navegador, no transformarse automáticamente en `fetch` JSON.

El backend autentica con cookie `HttpOnly` `veto_session`. El frontend no guarda ni lee tokens de sesión en `localStorage`. Las peticiones del navegador al API necesitan credenciales y la configuración CORS/`WEB_ORIGIN` debe coincidir con el entorno.

### Sesión visible en componentes

`SiteChrome` consulta `/identidad/me` al montar. Un `401` se interpreta como sesión ausente; otros errores se registran y también dejan la interfaz en estado anónimo. La función `notificarCambioSesion()` y el evento `veto:session-change` sincronizan cambios de sesión entre componentes montados en la misma pestaña; no son persistencia ni sincronización multi-pestaña. El estado de carga evita mostrar los controles de usuario antes de terminar la consulta inicial.

El cierre de sesión pasa por `/api/auth/logout` de Next, después actualiza el estado local y navega al inicio. Los enlaces del menú dependen del rol recibido (`TUTOR`, `VETERINARIO` u otros roles de aliado), aunque el backend sigue siendo la autoridad para autorizar operaciones.

### Mapa de integraciones existentes

| Área de UI                      | Rutas de API observadas en el código                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marco público y sesión          | `GET /api/identidad/me`; `POST /api/auth/logout` es un Route Handler local de Next que emite `Set-Cookie` para expirar `veto_session`; no existe llamada a un endpoint de logout en la API.                                                   |
| Clínicas y ficha                | `GET /api/aliados/clinicas`; `GET /api/aliados/:aliadoId/veterinarios`; `GET /api/aliados/:aliadoId/sedes`; `GET /api/aliados/:aliadoId/especies`; `GET /api/aliados/:aliadoId/servicios`; `GET /api/aliados/:aliadoId/confirmacion`.         |
| Autenticación                   | `POST /api/usuarios`; `POST /api/identidad/login`; `POST /api/identidad/login/2fa`; rutas Google de disponibilidad, pendiente, vincular y completar. Las rutas OAuth de inicio/retorno son navegación.                                        |
| Recuperación                    | `GET /api/identidad/recuperacion/disponible`; `POST /api/identidad/recuperacion/solicitar`; `POST /api/identidad/recuperacion/verificar`; `POST /api/identidad/recuperacion/restablecer`.                                                     |
| Perfil y seguridad              | `GET/PATCH/DELETE /api/identidad/me`; `GET /api/identidad/2fa`; `POST /api/identidad/2fa/activar`; `POST /api/identidad/2fa/activar/confirmar`; `GET /api/identidad/google/estado`; navegación a Google para reautenticar.                    |
| Mascotas                        | `GET /api/mascotas`; `GET /api/mascotas/especies`; operaciones `POST`, `PUT` y `DELETE` bajo `/api/mascotas` según el modo del formulario.                                                                                                    |
| Gestión aliado/veterinario      | Rutas `/api/aliados/:aliadoId/...`, `/api/veterinarios/me` y `/api/veterinarios/me/consultas`; incluye gestión según los formularios visibles de servicio, sede, equipo, especies, confirmación, horarios y reglas de precio.                 |
| Revisión Equipo Veto            | Rutas `/api/admin/fundaciones/pendientes`, `/api/admin/fundaciones/:fundacionId`, y acciones `aprobar`/`rechazar`.                                                                                                                            |
| Páginas de búsqueda y catálogos | El código actual de `/buscar`, `/veterinarios`, `/tienda` y `/adopcion` no llama a los endpoints de búsqueda general, productos ni catálogo de adopción. La existencia de endpoints backend no significa que estas pantallas ya los consuman. |

La lista es un mapa de integración de UI, no reemplaza el inventario contractual del backend. Al documentar una pantalla nueva, comprobar el verbo, el cuerpo, los query params, el rol y la respuesta en `api-backend.md` y en el controlador correspondiente.

## 5. Componentes y convenciones de interfaz

### Componentes compartidos

- `SiteChrome`: navegación pública/autenticación, búsqueda de cabecera, sesión, links dependientes del rol, menú móvil y pie.
- `BrandLogo`: marca reutilizable.
- `VetoButton`: variantes `primary`, `secondary`, `tertiary`, `danger` y `google`; admite `loading` y propaga `aria-busy`.
- `FieldError`: mensaje de error de campo accesible con `role="alert"`.
- `StatusBadge`, `SpeciesChip`, `AlertBox`, `Avatar`, `Skeleton` y `SectionCard`: patrones visuales reutilizables.
- `GoogleAuthButton`: comprueba disponibilidad de Google y ofrece el inicio del flujo.

Antes de crear un patrón nuevo, revisar estos componentes y los componentes específicos ya existentes, como `VeterinarioCard` y `PaginaPendiente`.

### Estilos y responsive

`globals.css` concentra un sistema de tokens CSS y las reglas específicas de las páginas. Los tokens incluyen colores de marca (borgoña, crema, durazno, salvia), superficies/texto y radios para botón, input, card y panel; Tailwind se configura sobre ellos mediante `@theme inline`.

- Mantener los tokens del producto y reutilizar los componentes existentes.
- Los estilos base globales se mantienen en `@layer base`, para que las utilidades de Tailwind puedan sobreescribirlos.
- Las reglas responsive generales actuales incluyen puntos de corte de `920px` y `640px`, además de reglas específicas en estilos de páginas. Verificar comportamiento en los tamaños requeridos por la HU, no asumir que cada página usa los mismos cortes.
- Hay soporte global de `prefers-reduced-motion`; conservarlo al añadir animaciones.
- Los recursos remotos visibles en algunas páginas provienen de URLs externas de imágenes. No asumir que están empaquetados localmente ni disponibles sin red.

### Accesibilidad observada/esperada en los patrones existentes

Usar etiquetas semánticas (`header`, `nav`, `main`, `footer`, `section`), nombres accesibles para controles, `aria-current` en navegación activa, estados `aria-expanded` para menú, `role="alert"` para errores y atributos de carga cuando correspondan. Mantener foco visible y no comunicar estado solo mediante color. La existencia de un patrón no certifica por sí sola que toda la aplicación esté completamente auditada.

## 6. Estados de interfaz y manejo de errores

Las pantallas conectadas deben distinguir carga, error, vacío y contenido según corresponda. La lista de clínicas ya ilustra esos estados con esqueletos, `AlertBox` y empty state. En las demás pantallas, comprobar el código concreto: no asumir un estado vacío/error funcional si la página no realiza consulta.

- Para llamadas de API usar `api()` y capturar `ApiError` cuando se necesite presentar mensaje/campos.
- Los formularios deben conservar entrada válida al corregir errores; enlazar mensajes de campo con el control (`aria-describedby`) cuando el patrón aplique.
- Evitar mostrar detalles de infraestructura o datos sensibles al usuario; el log de consola puede apoyar diagnóstico local pero no sustituye un estado de interfaz.
- Nunca inferir una sesión válida desde el menú; operaciones privadas deben manejar `401` y permisos denegados según el contrato del backend.
- Una respuesta vacía puede ser `[]`, `null` o un objeto con colección según el endpoint; tipar conforme al contrato real, no por analogía.

## 7. Prototipo Figma Make

La entrada Vite está en `frontend/figma/src/main.tsx` y `App.tsx`. Los archivos principales de referencia definidos en `AGENTS.md` son:

| Archivo                | Contenido                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| `src/App.tsx`          | Punto de entrada de la experiencia prototipada y selección de vistas. |
| `src/Inicio.tsx`       | Vista de inicio del tutor.                                            |
| `src/Layouts.tsx`      | Previsualizaciones de layouts público, autenticación y aliado.        |
| `src/DesignSystem.tsx` | Guía visual de marca y componentes.                                   |
| `src/index.css`        | Tokens y estilos del prototipo.                                       |

La aplicación Figma no consume la API de producción y sus flujos deben tratarse como prototipo hasta que se implementen y validen en `frontend/web/`. El servidor de desarrollo de Vite configurado por el workspace usa el puerto `8443`; seguir `AGENTS.md` y los scripts existentes, no iniciar un segundo servidor de previsualización.

## 8. Calidad y comandos

| Propósito               | Comando de workspace             | Comando enfocado                                                                                                                |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Desarrollo del monorepo | `pnpm dev`                       | `pnpm --filter @veto/web dev` (web, puerto 3000); `pnpm --filter @veto/figma dev` (prototipo, puerto 8443 según configuración). |
| Typecheck web           | `pnpm typecheck`                 | `pnpm --filter @veto/web typecheck`                                                                                             |
| Pruebas web             | `pnpm test`                      | `pnpm --filter @veto/web test`                                                                                                  |
| Build producción        | `pnpm build`                     | `pnpm build:frontend` compila shared y web; `pnpm --filter @veto/web build` compila solo web.                                   |
| Formato y lint          | `pnpm format:check`; `pnpm lint` | Prettier y ESLint no tienen comandos específicos de frontend en los scripts de paquete actuales.                                |

Las pruebas web usan Vitest (`frontend/web/vitest.config.ts`, entorno `node`, archivos `test/**/*.test.ts`). El conjunto actual contiene pruebas de la tarjeta de veterinario y utilidades; revisar si se necesita una prueba de interfaz adicional para el cambio. No afirmar cobertura de rutas enteras basándose solo en esos tests.

## 9. Variables y ejecución local

- `NEXT_PUBLIC_API_URL` define la URL pública de la API accesible desde el navegador. El fallback codificado actual es `http://localhost:3001/api`.
- En Docker o despliegues, distinguir la URL desde el navegador de la dirección interna entre contenedores; una variable `NEXT_PUBLIC_*` se incorpora al bundle y no debe contener secretos.
- La API debe estar disponible y aceptar credenciales CORS desde el origen de la web para que funcionen los flujos de sesión.
- El comando de desarrollo raíz construye primero `@veto/shared` y luego inicia los paquetes definidos en el script. Para ejecutar una sola app, usar el filtro correspondiente.
- No incluir credenciales, tokens ni valores privados del `.env` en este documento.

## 10. Límites y mantenimiento del contexto

- Este documento es una inspección estática del frontend versionado; no certifica comportamiento en un navegador ni disponibilidad de servicios externos.
- La web tiene rutas con niveles distintos de integración. En particular, que una ruta exista o que haya un endpoint de API no demuestra que el flujo esté conectado en la UI.
- Los contratos, roles, errores y reglas de negocio del backend se documentan en [`api-backend.md`](./api-backend.md) y deben validarse contra el código fuente vigente.
- Al cambiar rutas, llamadas API, estados de pantalla, componentes compartidos, tokens, breakpoints, configuración o pruebas, actualizar esta guía. Mantener los cambios acotados al contexto del frontend.
