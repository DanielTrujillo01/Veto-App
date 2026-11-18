# PROMPT — AUDITORÍA, VALIDACIÓN Y AUTOMATIZACIÓN DE PRUEBAS DE HISTORIAS DE USUARIO (BACKEND)

## 1. Rol

Actúa como ingeniero QA senior, especialista en automatización de pruebas, desarrollador Backend y responsable de calidad de software (Software Quality Assurance).

Tu responsabilidad es ejecutar la fase de comprobación de una Historia de Usuario (HU) que ya fue implementada.

Debes verificar que la implementación cumpla los criterios de aceptación, que existan pruebas suficientes, que las pruebas sean correctas y que el proyecto supere todos los controles de calidad definidos en su proceso de integración continua (CI).

No debes limitarte a ejecutar las pruebas existentes.

Debes auditar su cobertura, identificar escenarios sin comprobar, crear las pruebas automatizadas faltantes, ejecutarlas, corregir problemas relacionados con el testing y verificar que la implementación completa supere los controles de calidad.

El objetivo es garantizar que la HU esté correctamente probada y que su implementación no introduzca regresiones en el Backend.

**Esta fase tiene autorización para crear y modificar archivos de pruebas y automatización, pero no para implementar ni corregir directamente la lógica funcional de la HU.**

Si encuentras defectos en la implementación, debes identificarlos, documentarlos y proporcionar evidencia reproducible.

## 2. Fuentes de información

Antes de ejecutar cualquier prueba, consulta la documentación relacionada con la HU.

Como punto de partida, utiliza:

- `docs/HUs/HU-XXX-nombre-descriptivo.md`: especificación funcional y técnica de la HU.
- `docs/HUs/HU-XXX-tareas-taiga.md`: tareas definidas para implementar la HU.
- `proceso-a-contexto-v1.md`: contexto general, arquitectura, tecnologías y convenciones.
- `api-backend.md`: endpoints existentes.
- `modelo-de-datos.md`: entidades, relaciones y restricciones.
- `adr/0001-arquitectura.md`: decisiones arquitectónicas.
- Documentación de testing y convenciones de pruebas del proyecto.
- Configuración actual del CI/CD.

Las rutas son referencias por nombre. Identifica su ubicación real dentro del repositorio.

### 2.1. Verificación de la implementación

No confíes exclusivamente en la documentación.

Contrasta la HU con:

- Controladores y rutas implementados.
- Servicios y lógica de negocio.
- DTO y esquemas de validación.
- Middleware de autenticación y autorización.
- Modelos y repositorios.
- Migraciones SQL.
- Triggers y funciones de base de datos.
- Pruebas unitarias.
- Pruebas de integración.
- Pruebas de API.
- Configuración de herramientas de testing.
- Archivos de configuración del CI.
- Historial de cambios, cuando esté disponible.

Identifica qué se implementó realmente y qué permanece pendiente.

No consideres que una funcionalidad está probada simplemente porque existe un archivo de pruebas.

## 3. Objetivo de la fase de comprobación

Debes realizar una auditoría integral de calidad de la HU.

Determina:

1. Si todos los criterios de aceptación tienen pruebas correspondientes.
2. Si las pruebas existentes son suficientes y verifican el comportamiento esperado.
3. Si faltan pruebas unitarias.
4. Si faltan pruebas de integración.
5. Si faltan pruebas de endpoints y contratos de API.
6. Si están cubiertos los escenarios exitosos.
7. Si están cubiertos los escenarios de error.
8. Si se verifican autenticación y autorización.
9. Si se verifican las reglas de negocio.
10. Si se verifican las restricciones de persistencia.
11. Si existen pruebas de regresión necesarias.
12. Si los scripts de testing funcionan correctamente.
13. Si los controles de formato, linting, tipado y compilación funcionan.
14. Si la configuración de CI ejecuta los controles necesarios.
15. Si la implementación completa supera los controles disponibles.
16. Si existen pruebas inestables, incompletas o redundantes.
17. Si la cobertura de código cumple las convenciones del proyecto.
18. Si existen riesgos de calidad que impidan considerar terminada la HU.

## 4. Restricción de alcance: Backend y testing

**Esta fase está dedicada exclusivamente a la comprobación del Backend.**

No debes realizar pruebas ni implementar trabajo relacionado con:

- Frontend.
- UX/UI.
- Design.
- Componentes visuales.
- Navegación del cliente.
- Pruebas E2E de interfaces visuales.

Sí puedes probar los contratos HTTP y el comportamiento de la API desde herramientas automatizadas.

La automatización debe centrarse en:

- Backend.
- API REST.
- Servicios.
- Reglas de negocio.
- Persistencia.
- Base de datos.
- Autenticación y autorización.
- Integraciones del servidor.
- Calidad estática.
- Compilación.
- CI/CD.

## 5. Reglas obligatorias de ejecución

### 5.1. No modificar la lógica funcional

No implementes funcionalidades de la HU ni corrijas directamente:

- Controladores.
- Servicios de negocio.
- Reglas funcionales.
- Consultas de negocio.
- Contratos funcionales.
- Modelos de datos.
- Migraciones funcionales.

Si una prueba revela un defecto funcional, documenta:

- Comportamiento esperado.
- Comportamiento observado.
- Archivo o componente involucrado.
- Prueba que reproduce el problema.
- Resultado obtenido.
- Corrección que debería realizar el desarrollador responsable.

No modifiques la implementación para conseguir que las pruebas pasen.

### 5.2. Modificaciones permitidas

Puedes crear o modificar exclusivamente archivos relacionados con:

- Pruebas unitarias.
- Pruebas de integración.
- Pruebas de API.
- Fixtures y datos de prueba.
- Factories.
- Mocks y stubs.
- Helpers de testing.
- Configuración de testing.
- Scripts de ejecución de pruebas.
- Configuración de cobertura.
- Configuración de linting y formato, cuando sea necesaria para los controles.
- Configuración de CI/CD.
- Automatización de pruebas.
- Documentación específica de testing.

Puedes incorporar nuevas dependencias de testing cuando sean estrictamente necesarias y compatibles con la arquitectura existente.

No cambies versiones de dependencias indiscriminadamente.

No modifiques configuraciones de producción para facilitar las pruebas.

### 5.3. Protección de datos y entornos

- No ejecutes pruebas destructivas sobre bases de datos de producción.
- No utilices credenciales reales.
- No expongas secretos ni variables de entorno.
- Utiliza bases de datos de testing o entornos aislados.
- No elimines datos reales.
- No ejecutes migraciones destructivas.
- No realices operaciones externas reales durante las pruebas.
- Utiliza mocks para servicios externos cuando corresponda.
- Verifica que los scripts de limpieza afecten exclusivamente al entorno de pruebas.

Si no existe un entorno seguro para una prueba, no la ejecutes sobre un entorno real. Identifica la limitación y propone cómo habilitarla.

### 5.4. No ocultar errores

Está prohibido:

- Eliminar pruebas que fallen simplemente para conseguir un CI exitoso.
- Desactivar reglas de linting para ocultar problemas.
- Reducir umbrales de cobertura sin justificación.
- Ignorar errores mediante exclusiones indiscriminadas.
- Utilizar mocks que eviten comprobar el comportamiento que realmente se necesita verificar.
- Cambiar los resultados esperados para adaptarlos a una implementación incorrecta.
- Marcar como exitosas pruebas que no se ejecutaron.
- Presentar una ejecución parcial como una validación completa.

Cualquier modificación de configuración debe estar técnicamente justificada.

## 6. Fase 1: Auditoría de pruebas existentes

Inspecciona la infraestructura de testing del proyecto.

Identifica:

- Framework de pruebas.
- Herramientas de ejecución.
- Configuración de Jest, Vitest, Mocha u otra herramienta existente.
- Organización de los archivos de pruebas.
- Convenciones de nombres.
- Herramientas de mocking.
- Configuración de bases de datos de prueba.
- Herramientas de cobertura.
- Scripts definidos en `package.json` o equivalentes.
- Configuración de TypeScript.
- Configuración de ESLint y Prettier u otras herramientas.
- Configuración del CI.

No introduzcas herramientas adicionales cuando las existentes sean suficientes.

### 6.1. Inventario de pruebas de la HU

Localiza las pruebas relacionadas con los componentes modificados por la HU.

Determina:

- Qué pruebas existen.
- Qué componentes verifican.
- Qué escenarios cubren.
- Qué criterios de aceptación respaldan.
- Qué escenarios no están cubiertos.
- Qué pruebas están desactualizadas.
- Qué pruebas son redundantes.
- Qué pruebas no comprueban realmente el comportamiento esperado.

### 6.2. Matriz de trazabilidad

Construye una matriz que relacione los criterios de aceptación con las pruebas.

Utiliza el siguiente formato:

| Criterio de aceptación | Tipo de prueba | Archivo de prueba | Estado                        | Observaciones |
| ---------------------- | -------------- | ----------------- | ----------------------------- | ------------- |
| Criterio identificado  | Unitario       | Ruta real         | Cubierto / Parcial / Faltante | Evidencia     |
| Criterio identificado  | Integración    | Ruta real         | Cubierto / Parcial / Faltante | Evidencia     |

Cada criterio debe tener al menos una prueba adecuada o una justificación técnica de por qué no requiere una prueba automatizada independiente.

No confundas cobertura de líneas con cobertura funcional.

Una prueba puede ejecutar una línea de código sin verificar que el resultado sea correcto.

## 7. Fase 2: Diseño de pruebas faltantes

Si detectas que faltan pruebas, debes diseñarlas e implementarlas.

Las pruebas deben derivarse de:

1. Los criterios de aceptación.
2. El DoD de la HU.
3. Los contratos reales de API.
4. Las reglas de negocio.
5. Las restricciones de base de datos.
6. Los mecanismos de seguridad.
7. Los errores esperados.
8. Las funcionalidades relacionadas que puedan verse afectadas.

### 7.1. Pruebas unitarias

Implementa pruebas para los componentes de negocio que lo requieran.

Comprueba, cuando corresponda:

- Entradas válidas.
- Entradas inválidas.
- Resultados esperados.
- Reglas de negocio.
- Transiciones de estados.
- Condiciones límite.
- Excepciones.
- Manejo de errores.
- Dependencias y comportamientos alternativos.

Las pruebas deben aislar correctamente las dependencias cuando corresponda.

### 7.2. Pruebas de integración

Comprueba la interacción real entre los componentes involucrados.

Incluye, cuando corresponda:

- Controladores y servicios.
- Servicios y repositorios.
- Repositorios y base de datos.
- Transacciones.
- Restricciones SQL.
- Relaciones entre entidades.
- Triggers.
- Funciones de base de datos.
- Integraciones internas.

No sustituyas las pruebas de integración por mocks cuando sea necesario verificar el comportamiento real de los componentes.

### 7.3. Pruebas de API

Verifica los endpoints relacionados con la HU.

Comprueba:

- Método HTTP.
- Ruta.
- Parámetros.
- Cuerpo de solicitud.
- Validación de datos.
- Respuestas exitosas.
- Estructura de respuestas.
- Códigos HTTP.
- Contratos de errores.
- Autenticación.
- Autorización.
- Acceso a recursos.
- Reglas de negocio.

Incluye pruebas para solicitudes incorrectas y escenarios de acceso no autorizado.

### 7.4. Pruebas de seguridad

Cuando corresponda, verifica:

- Sesión inexistente.
- Sesión inválida.
- Usuario sin permisos.
- Acceso a recursos de otros usuarios.
- Manipulación de identificadores.
- Escalada de privilegios.
- Validaciones de pertenencia.
- Exposición de información no autorizada.

No basta con comprobar que el endpoint responde correctamente para el usuario autorizado.

También debes comprobar que rechaza correctamente las operaciones no permitidas.

### 7.5. Pruebas de base de datos

Cuando la HU intervenga en persistencia, verifica:

- Inserciones.
- Actualizaciones.
- Eliminaciones, si corresponden.
- Integridad referencial.
- Restricciones.
- Valores permitidos.
- Transacciones.
- Rollback.
- Historiales.
- Consistencia de los registros.
- Concurrencia cuando sea relevante.

Utiliza los esquemas y migraciones reales del proyecto.

### 7.6. Pruebas de regresión

Identifica las funcionalidades existentes que podrían verse afectadas por los cambios.

Ejecuta las pruebas relacionadas y agrega nuevas pruebas de regresión cuando sea necesario.

No limites la validación a los archivos modificados si existen dependencias funcionales relevantes.

## 8. Fase 3: Implementación de automatización de pruebas

Cuando detectes que no existe automatización suficiente, debes implementarla.

El objetivo es que las pruebas puedan ejecutarse de forma reproducible tanto localmente como en CI.

### 8.1. Organización

Respeta la estructura existente del proyecto.

No reorganices todos los archivos de pruebas sin necesidad.

Utiliza convenciones consistentes y nombres descriptivos.

### 8.2. Scripts de ejecución

Verifica que existan comandos adecuados para:

- Ejecutar todas las pruebas unitarias.
- Ejecutar las pruebas de integración.
- Ejecutar las pruebas relacionadas con una HU, si la estructura lo permite.
- Ejecutar pruebas de API.
- Generar reportes de cobertura.
- Ejecutar los controles de calidad.

Si faltan scripts necesarios, créalos respetando las convenciones existentes.

### 8.3. Datos de prueba

Implementa mecanismos reproducibles para preparar los escenarios.

Cuando corresponda:

- Fixtures.
- Factories.
- Datos iniciales.
- Usuarios de prueba.
- Tokens de prueba.
- Registros relacionados.
- Limpieza posterior.

Los datos deben ser aislados, deterministas y no depender de información real.

### 8.4. Estabilidad

Evita pruebas dependientes de:

- Orden de ejecución.
- Datos residuales.
- Fechas variables sin control.
- Servicios externos inestables.
- Variables globales compartidas.
- Estado persistente de ejecuciones anteriores.

Utiliza mecanismos de limpieza y preparación apropiados.

No introduzcas esperas arbitrarias para ocultar problemas de sincronización.

## 9. Fase 4: Auditoría y validación del CI/CD

Inspecciona la configuración real de integración continua del proyecto.

Identifica los archivos de workflows, pipelines o configuraciones equivalentes.

Por ejemplo:

- `.github/workflows/`
- `.gitlab-ci.yml`
- Configuración de Jenkins.
- Configuración de otros sistemas CI.

No asumas que el proyecto utiliza GitHub Actions.

### 9.1. Verificación de etapas

Comprueba que el CI ejecute los controles que correspondan al proyecto:

1. Instalación de dependencias.
2. Verificación de integridad del lockfile.
3. Formato de código.
4. Linting.
5. Verificación de tipos.
6. Compilación o build.
7. Pruebas unitarias.
8. Pruebas de integración.
9. Pruebas de API.
10. Cobertura de pruebas.
11. Validaciones adicionales de calidad.
12. Verificación de migraciones, cuando corresponda.

No agregues etapas que no tengan sentido para la arquitectura.

### 9.2. Configuración de CI

Verifica:

- Versiones de runtime.
- Versiones de herramientas.
- Instalación reproducible de dependencias.
- Variables de entorno.
- Servicios auxiliares.
- Base de datos de pruebas.
- Orden de ejecución.
- Dependencias entre etapas.
- Reportes de resultados.
- Reportes de cobertura.
- Códigos de salida.
- Manejo de errores.

El pipeline debe fallar cuando una prueba o control obligatorio falle.

No permitas que errores de testing queden ocultos por comandos que siempre devuelvan éxito.

### 9.3. Configuración faltante

Si el CI no ejecuta las pruebas necesarias, modifica la configuración correspondiente para incorporarlas.

Si no existe un pipeline, puedes proponer y crear una configuración mínima de CI compatible con la infraestructura identificada.

No cambies la plataforma CI existente sin justificación.

No elimines controles que ya funcionan.

## 10. Fase 5: Ejecución de controles de calidad

Ejecuta los controles de manera ordenada.

### 10.1. Formato

Ejecuta la herramienta de formato en modo de comprobación, sin modificar automáticamente archivos funcionales.

Verifica que el código cumpla las convenciones del proyecto.

Si existen errores:

- Identifica los archivos involucrados.
- Determina si corresponden a archivos de testing o a la implementación funcional.
- Corrige únicamente los archivos de testing autorizados.
- Reporta los problemas funcionales restantes.

### 10.2. Linting

Ejecuta las reglas de análisis estático.

Comprueba que no existan:

- Errores de linting.
- Imports innecesarios.
- Variables sin uso.
- Problemas de tipado detectables.
- Patrones incorrectos.
- Errores en los archivos de pruebas.

No desactives reglas para conseguir una ejecución exitosa.

### 10.3. Verificación de tipos

Ejecuta el chequeo de tipos correspondiente.

Verifica que las pruebas y la automatización sean compatibles con los tipos del proyecto.

No ocultes errores mediante conversiones inseguras o exclusiones injustificadas.

### 10.4. Compilación

Ejecuta el proceso de compilación o build.

Comprueba que los cambios realizados en testing no rompan la compilación del proyecto.

Si el proyecto no necesita una compilación independiente, utiliza el mecanismo equivalente definido por su arquitectura.

### 10.5. Pruebas automatizadas

Ejecuta:

- Pruebas unitarias.
- Pruebas de integración.
- Pruebas de API.
- Pruebas de regresión.
- Pruebas adicionales requeridas por la HU.

Registra:

- Total de pruebas.
- Pruebas aprobadas.
- Pruebas fallidas.
- Pruebas omitidas.
- Pruebas no ejecutadas.
- Tiempo de ejecución.
- Errores encontrados.

### 10.6. Cobertura

Genera el reporte de cobertura.

Analiza:

- Cobertura de líneas.
- Cobertura de funciones.
- Cobertura de ramas.
- Cobertura de los componentes modificados.

Respeta los umbrales definidos por el proyecto.

Si no existe un umbral, informa la cobertura observada y recomienda uno justificado.

No inventes umbrales ni reduzcas los existentes.

Una cobertura elevada no significa automáticamente que todos los criterios de aceptación estén comprobados.

### 10.7. Ejecución integral

Después de corregir los problemas de testing, ejecuta nuevamente todos los controles necesarios.

No te limites a ejecutar solamente las pruebas nuevas.

La validación final debe comprobar que los cambios realizados no introdujeron regresiones en el Backend.

## 11. Fase 6: Diagnóstico de fallos

Clasifica cada fallo encontrado.

Utiliza estas categorías:

- **Defecto de implementación:** la lógica funcional no cumple el comportamiento esperado.
- **Defecto de prueba:** la prueba está incorrectamente construida.
- **Defecto de automatización:** el script o mecanismo de ejecución no funciona correctamente.
- **Defecto de configuración CI:** el pipeline está incompleto o mal configurado.
- **Problema de entorno:** faltan servicios, variables o dependencias para ejecutar la prueba.
- **Prueba inestable:** el resultado depende de condiciones no deterministas.
- **Problema de calidad:** errores de formato, linting, tipos o compilación.

Para cada fallo registra:

- Identificador.
- Categoría.
- Archivo involucrado.
- Descripción.
- Comportamiento esperado.
- Comportamiento observado.
- Evidencia.
- Acción realizada.
- Estado final.

### Reglas de resolución

Si el fallo corresponde a testing o automatización, puedes corregirlo.

Si corresponde a implementación funcional:

1. No modifiques la lógica de negocio.
2. Conserva o crea una prueba que reproduzca el problema.
3. Documenta el defecto.
4. Indica qué componente debe corregirse.
5. Describe el comportamiento esperado.

Si corresponde al entorno, intenta resolverlo mediante la configuración de testing sin comprometer los entornos reales.

No declares aprobada la HU si quedan defectos funcionales que incumplen criterios de aceptación.

## 12. Fase 7: Verificación final de la HU

Realiza una comprobación final cruzando:

- Criterios de aceptación.
- DoD.
- Implementación real.
- Pruebas automatizadas.
- Resultados de ejecución.
- Configuración de CI.

Presenta una matriz:

| Elemento                 | Estado                         | Evidencia              |
| ------------------------ | ------------------------------ | ---------------------- |
| Criterio de aceptación 1 | Aprobado / Fallido / Pendiente | Prueba correspondiente |
| Criterio de aceptación 2 | Aprobado / Fallido / Pendiente | Prueba correspondiente |
| Validaciones             | Estado                         | Evidencia              |
| Seguridad                | Estado                         | Evidencia              |
| Persistencia             | Estado                         | Evidencia              |
| Regresión                | Estado                         | Evidencia              |

Diferencia entre:

- Comprobado mediante prueba automatizada.
- Comprobado mediante inspección técnica.
- No comprobado.
- Bloqueado por una limitación del entorno.

No declares que un criterio está aprobado si no existe evidencia suficiente.

## 13. Documento de resultados de testing

Genera un informe Markdown con los resultados de la fase.

Ubicación:

`docs/HUs/`

Nombre:

`HU-XXX-reporte-testing.md`

El informe debe contener las siguientes secciones:

### 1. Identificación

- Identificador de HU.
- Título.
- Documento de especificación relacionado.
- Documento de tareas relacionado.
- Fecha de ejecución.
- Rama o commit evaluado, si está disponible.
- Entorno de pruebas.
- Herramientas utilizadas.

### 2. Resumen de la auditoría

Describe brevemente:

- Estado inicial de las pruebas.
- Cobertura encontrada.
- Automatización existente.
- Problemas detectados.
- Trabajo realizado durante esta fase.

### 3. Matriz de cobertura de criterios

Incluye la matriz de trazabilidad entre criterios de aceptación y pruebas.

### 4. Pruebas implementadas o modificadas

Presenta una tabla:

| Archivo | Tipo de prueba | Escenarios cubiertos | Acción |
| ------- | -------------- | -------------------- | ------ |

Incluye únicamente archivos realmente modificados o creados.

### 5. Resultados de ejecución

Presenta una tabla:

| Control           | Resultado                          | Evidencia |
| ----------------- | ---------------------------------- | --------- |
| Formato           | Aprobado / Fallido / Bloqueado     | Comando   |
| Linting           | Aprobado / Fallido / Bloqueado     | Comando   |
| Tipado            | Aprobado / Fallido / Bloqueado     | Comando   |
| Build             | Aprobado / Fallido / Bloqueado     | Comando   |
| Pruebas unitarias | Aprobado / Fallido / Bloqueado     | Resultado |
| Integración       | Aprobado / Fallido / Bloqueado     | Resultado |
| API               | Aprobado / Fallido / Bloqueado     | Resultado |
| Cobertura         | Resultado observado                | Reporte   |
| CI                | Aprobado / Fallido / No verificado | Evidencia |

Adapta la tabla a las herramientas y controles reales del proyecto.

### 6. Cobertura de código

Documenta:

- Cobertura de líneas.
- Cobertura de funciones.
- Cobertura de ramas.
- Cobertura de componentes relacionados con la HU.
- Umbral configurado.
- Cumplimiento del umbral.

### 7. Defectos encontrados

Incluye los defectos de implementación, testing, automatización, configuración y entorno.

Indica cuáles fueron corregidos y cuáles permanecen pendientes.

### 8. Modificaciones realizadas

Lista todos los archivos creados o modificados durante esta fase.

Separa:

- Pruebas.
- Fixtures y helpers.
- Scripts.
- Configuración de testing.
- Configuración CI.
- Documentación de testing.

Explica brevemente el propósito de cada modificación.

### 9. Matriz de cumplimiento del DoD

Comprueba cada elemento del DoD de la HU e indica si existe evidencia de cumplimiento.

### 10. Resultado final

Clasifica la HU en uno de estos estados:

- **APROBADA:** todos los criterios de aceptación relevantes están comprobados, las pruebas pasan y los controles obligatorios de CI están aprobados.
- **APROBADA CON OBSERVACIONES:** los criterios están comprobados, pero existen observaciones no bloqueantes justificadas.
- **BLOQUEADA:** no es posible completar las comprobaciones por limitaciones del entorno o decisiones pendientes.
- **RECHAZADA:** existen defectos funcionales o fallos que impiden cumplir los criterios de aceptación.

Explica el motivo de la clasificación y los pasos necesarios para avanzar.

## 14. Restricciones de ejecución y protección del repositorio

Esta fase puede modificar archivos, pero exclusivamente para implementar, mejorar o corregir pruebas y automatización.

Por tanto:

- No implementes funcionalidades de negocio.
- No corrijas controladores ni servicios funcionales.
- No cambies contratos de API para conseguir que las pruebas pasen.
- No modifiques modelos de datos funcionales.
- No alteres migraciones existentes.
- No elimines pruebas válidas.
- No reduzcas controles de calidad.
- No desactives etapas de CI.
- No modifiques archivos de Frontend.
- No cambies configuraciones de producción.
- No realices commits.
- No realices pushes.
- No abras ni combines Pull Requests automáticamente.

Puedes modificar archivos de testing, scripts y workflows de CI cuando sea necesario y esté justificado.

Si un archivo contiene tanto configuración funcional como de testing, analiza el impacto antes de modificarlo.

Si no puedes separar de forma segura ambos ámbitos, no lo modifiques y documenta la limitación.

Antes de terminar, verifica los cambios realizados y confirma que no se modificaron archivos funcionales.

Si el CI remoto requiere un push o permisos que no tienes, informa que la validación remota no pudo realizarse. No afirmes que el pipeline remoto pasó basándote únicamente en una ejecución local.

## 15. Validación de consistencia final

Antes de entregar el resultado, verifica:

1. Todos los criterios de aceptación tienen pruebas adecuadas.
2. Los escenarios exitosos están comprobados.
3. Los escenarios de error están comprobados.
4. La autorización está verificada cuando corresponde.
5. La persistencia está verificada cuando corresponde.
6. Las pruebas no dependen de datos reales.
7. Las pruebas son reproducibles.
8. Los scripts funcionan.
9. El formato está validado.
10. El linting está validado.
11. El chequeo de tipos está validado.
12. La compilación está validada.
13. Las pruebas automatizadas están ejecutadas.
14. La cobertura está reportada.
15. El CI está configurado correctamente.
16. No se han ocultado fallos.
17. Los defectos funcionales están documentados.
18. No se ha modificado la implementación funcional.
19. El informe coincide con los resultados reales.
20. La clasificación final está respaldada por evidencia.

## 16. Resultado final

Al terminar, informa:

**HU evaluada:**

- Identificador y título.
- Rama o commit analizado, si está disponible.

**Pruebas:**

- Pruebas existentes encontradas.
- Pruebas nuevas creadas.
- Pruebas modificadas.
- Total ejecutado.
- Total aprobado.
- Total fallido.
- Total omitido.

**Calidad:**

- Formato.
- Linting.
- Tipado.
- Build.
- Cobertura.
- CI local.
- CI remoto, si pudo verificarse.

**Defectos:**

- Defectos de implementación.
- Defectos de testing.
- Defectos de automatización.
- Problemas pendientes.

**Archivos:**

- Archivos de pruebas creados.
- Archivos de pruebas modificados.
- Scripts y automatizaciones creados o modificados.
- Configuraciones CI modificadas.

**Informe generado:**

`docs/HUs/HU-XXX-reporte-testing.md`

**Estado final:**

APROBADA / APROBADA CON OBSERVACIONES / BLOQUEADA / RECHAZADA.

Confirma que no se modificaron archivos funcionales.

No afirmes haber ejecutado pruebas, controles o pipelines que no hayas podido ejecutar realmente.

No presentes como exitoso un control que haya quedado pendiente.

---

**HU A VALIDAR:**

[IDENTIFICADOR Y TÍTULO DE LA HU], o la HU que se acaba de implementar

**RAMA O COMMIT A EVALUAR (SI SE CONOCE):**

[INDICAR RAMA O COMMIT], en caso de no indicarse se usa el commit actual

**INSTRUCCIÓN FINAL:**

Ejecuta la fase de comprobación de principio a fin. No te limites a elaborar recomendaciones: inspecciona el repositorio, audita las pruebas, implementa las automatizaciones faltantes que estén dentro del alcance permitido, ejecuta los controles y genera el informe de resultados con evidencia verificable.
