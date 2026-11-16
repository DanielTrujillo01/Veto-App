Lee la especificación funcional y técnica de la HU indicada y su documento de tareas para Taiga. Implementa en el proyecto únicamente el trabajo Backend necesario para completar esa HU.

Antes de cambiar código:
1. Revisa la HU, sus tareas y los componentes existentes relacionados.
2. Contrasta endpoints, esquemas, modelos, migraciones y pruebas para evitar duplicar funcionalidad.
3. Respeta las decisiones confirmadas y el alcance. Si hay una decisión bloqueante o contradicción, no la inventes: indícala y continúa con el trabajo independiente que sí esté definido.

Durante la implementación:
- Sigue la arquitectura y convenciones actuales del repositorio.
- Reutiliza servicios, validaciones y consultas existentes.
- No agregues cambios de Frontend, UX/UI ni funcionalidades ajenas a la HU.
- Crea migraciones solo si la especificación demuestra que son necesarias.
- Añade o actualiza pruebas para los criterios de aceptación y documenta los endpoints modificados.

Al terminar, ejecuta las verificaciones aplicables del proyecto y reporta:
- Archivos modificados y comportamiento implementado.
- Tareas de la HU completadas y cualquier bloqueo pendiente.
- Pruebas y comandos ejecutados, con sus resultados.
- Riesgos o diferencias entre la especificación y el código encontrado.

HU a implementar: [HU-XXX]
Especificación: docs/prompts/HUs/
Tareas: docs/prompts/HUs/
