# Informe de seguimiento de la ejecución · Guía de métricas

Esta guía explica **qué métricas usar para monitorear Veto, cómo calcularlas y de dónde sacar los
datos**, y deja una plantilla para armar el informe del sprint 2. Los números que aparecen como
"ejemplo" son inventados solo para mostrar la cuenta; los que dicen "real" salen del repositorio.

---

## 1. Qué se espera de este informe

Un informe de seguimiento responde cuatro preguntas, siempre comparando **lo planeado contra lo real**:

1. **¿Vamos al ritmo prometido?** (alcance y cronograma)
2. **¿Lo que entregamos tiene calidad?** (pruebas, defectos, retrabajo)
3. **¿Cuánto esfuerzo nos está costando?** (horas, carga del equipo)
4. **¿Qué nos puede salir mal y qué estamos haciendo?** (riesgos y acciones)

No se trata de medir mucho, sino de medir **pocas cosas bien** y explicar qué decidieron con ellas.
Una métrica sin interpretación ni acción no sirve: junto a cada número, escriban "qué significa" y
"qué haremos".

---

## 2. Las métricas recomendadas (8 en total)

Recomiendo estas ocho: cubren las cuatro preguntas y se pueden calcular con lo que ya tienen
(backlog, GitHub y CI). Si les piden "más", agreguen las de la sección 3.

| #   | Métrica                        | Responde                        | Fórmula                                          | Fuente de datos            |
| --- | ------------------------------ | ------------------------------- | ------------------------------------------------ | -------------------------- |
| M1  | Avance de alcance              | ¿Cuánto llevamos?               | HU terminadas ÷ HU comprometidas × 100           | Tablero del backlog        |
| M2  | Velocidad del sprint           | ¿A qué ritmo trabajamos?        | Puntos de las HU terminadas en el sprint         | Tablero + estimaciones     |
| M3  | Burndown / burnup              | ¿Vamos bien dentro del sprint?  | Puntos pendientes (o hechos) por día             | Tablero, fotografía diaria |
| M4  | Índice de cumplimiento (SPI)   | ¿Vamos adelantados o atrasados? | Valor ganado ÷ valor planeado                    | Tablero + plan             |
| M5  | Esfuerzo planeado vs. real     | ¿Estimamos bien?                | Horas reales ÷ horas estimadas                   | Registro de horas          |
| M6  | Calidad de la integración (CI) | ¿Lo que entra funciona?         | Ejecuciones de CI exitosas ÷ ejecuciones totales | GitHub Actions             |
| M7  | Defectos                       | ¿Cuántos errores hay?           | Defectos abiertos, cerrados y por HU             | Issues de GitHub           |
| M8  | Riesgos                        | ¿Qué amenaza el proyecto?       | Probabilidad × impacto, por riesgo               | Matriz de riesgos          |

### M1 · Avance de alcance

**Qué mide:** qué parte de lo prometido está realmente terminada.

**Cómo calcularla:**

- Una HU cuenta como **terminada solo si cumple su DoD completo** (el del backlog + el DoD común del
  documento `historias-refinadas.md`). "Casi lista" cuenta como cero.
- Avance del sprint = HU terminadas ÷ HU comprometidas × 100.
- Avance del proyecto = HU terminadas en total ÷ 55 HU esenciales × 100 (el modelo de datos define 55
  esenciales; verifiquen con el PO si el total sigue vigente).

**Ejemplo:** el sprint 2 compromete 22 HU. Si terminan 17: 17 ÷ 22 = **77 %**.
Si hasta ahora se terminaron 30 de 55 esenciales: 30 ÷ 55 = **55 %** del proyecto.

**Interpretación:** por debajo de lo que se esperaba para esa fecha → explicar la causa (HU
bloqueada, subestimada, cambió el alcance).

### M2 · Velocidad

**Qué mide:** cuánto trabajo termina el equipo por sprint. Sirve para **predecir** los sprints
siguientes.

**Cómo calcularla:**

- Si estiman en **puntos de historia**: suma los puntos de las HU terminadas (solo las terminadas).
- Si no estiman en puntos: usen **cantidad de HU**, o una talla simple (S = 1, M = 2, L = 3) y sumen.
- Velocidad promedio = promedio de los sprints cerrados.
- Proyección: sprints restantes = puntos pendientes ÷ velocidad promedio.

**Ejemplo:** sprint 1 = 24 puntos, sprint 2 = 30 puntos → promedio 27. Si quedan 54 puntos, faltan
54 ÷ 27 = **2 sprints**.

**Cuidado:** la velocidad no se usa para comparar personas ni para "exigir más"; solo para planear.
Si cambian la forma de estimar, la comparación deja de valer.

### M3 · Burndown (o burnup)

**Qué mide:** si el trabajo del sprint avanza de forma pareja o se acumula al final.

**Cómo hacerlo:**

1. Cada día (de preferencia a la misma hora) anoten **cuántos puntos quedan pendientes**.
2. Dibujen dos líneas: la **ideal** (baja en línea recta de los puntos comprometidos a 0) y la
   **real**.
3. Si usan _burnup_, dibujen los puntos terminados subiendo y una línea horizontal con el alcance;
   así se ve claro si el alcance cambió a mitad de sprint.

**Cómo leerlo:** línea real por encima de la ideal = atraso; plana y luego cae de golpe = se está
terminando todo al final y no se está integrando de forma continua.

> **Dato real del repositorio:** de los 109 commits que tiene `develop`, **69 ocurrieron en una sola
> semana** (la del 2 al 8 de noviembre), y solo 12 en la siguiente. Eso es justo el patrón de "todo al
> final" que el burndown permite ver. Si se repite en el sprint 2, vale la pena mencionarlo en el
> informe como riesgo de calidad y de integración.

### M4 · Índice de cumplimiento del cronograma (SPI)

**Qué mide:** adelanto o atraso frente al plan, con la técnica de **valor ganado** (la que suelen
pedir en gestión de proyectos).

**Definiciones simples** (usando puntos, o horas si las tienen):

- **VP, valor planeado:** puntos que, según el plan, debían estar terminados a la fecha de corte.
- **VG, valor ganado:** puntos realmente terminados a esa fecha.
- **Variación del cronograma (SV)** = VG − VP.
- **SPI** = VG ÷ VP.

**Ejemplo:** a mitad del sprint debían estar hechos 15 puntos (VP = 15) y hay 12 (VG = 12).
SPI = 12 ÷ 15 = **0,80** → vamos al 80 % del ritmo planeado. SV = 12 − 15 = **−3 puntos**.

| SPI        | Lectura             |
| ---------- | ------------------- |
| ≥ 1,0      | A tiempo o adelante |
| 0,9 a 0,99 | Atraso leve         |
| < 0,9      | Atraso a corregir   |

(Los umbrales son una convención; escriban cuáles usan.)

### M5 · Esfuerzo planeado vs. real

**Qué mide:** qué tan buenas fueron las estimaciones y cuánto cuesta el proyecto (en horas).

**Cómo calcularla:**

- Cada integrante registra las horas dedicadas por HU (una hoja de cálculo basta).
- **Desviación del esfuerzo** = (horas reales − horas estimadas) ÷ horas estimadas × 100.
- Si quieren índice de costo: **CPI** = valor ganado ÷ costo real (en horas) — mayor a 1 es mejor.
- **Carga por persona** = horas de cada persona ÷ horas totales. Sirve para detectar si una
  persona carga mucho más que el resto.

**Ejemplo:** HU-031 estimada en 16 h y real 24 h → desviación = (24 − 16) ÷ 16 = **+50 %**.
Al ver varias HU con desviación positiva, ajusten cómo estiman.

### M6 · Calidad de la integración continua (CI)

**Qué mide:** qué tan seguido el código que se sube pasa las verificaciones.

El repositorio ya ejecuta en cada pull request: formato, lint, tipos, pruebas y compilación, con una
base PostgreSQL (`.github/workflows/ci.yml`). Aprovéchenlo:

- **Tasa de éxito del CI** = ejecuciones exitosas ÷ ejecuciones totales × 100.
- **Pull requests que fallaron CI en el primer intento** ÷ pull requests totales.
- **Tiempo de revisión** = fecha de mezcla − fecha de apertura del PR (promedio).
- **Pruebas automáticas:** cantidad de pruebas y cuántas pasan. **Dato real:** `develop` tiene hoy
  76 archivos de prueba (24 de ellos en la API) entre API, `@veto/shared` y web.
- **Cobertura** (opcional): % del código que ejecutan las pruebas. Hoy no se mide; si la quieren,
  hay que activarla en Jest/Vitest.

**Ejemplo:** de 40 ejecuciones de CI, 34 pasaron → **85 %**.

### M7 · Defectos

**Qué mide:** cuántos errores se encuentran y qué tan rápido se corrigen.

**Cómo hacerlo:** cada error se registra como _issue_ de GitHub con etiqueta `bug`, la HU afectada y
una severidad (Crítico / Alto / Medio / Bajo).

- **Defectos abiertos** y **cerrados** por sprint.
- **Tasa de corrección** = defectos cerrados ÷ defectos encontrados × 100.
- **Densidad de defectos** = defectos ÷ HU terminadas (o ÷ puntos).
- **Tiempo medio de corrección** = promedio (fecha de cierre − fecha de apertura).
- **Retrabajo:** commits o PR de tipo `fix` ÷ total. Como el equipo ya usa Conventional Commits
  (`feat`, `fix`…), se puede contar directo con `git log --grep`.

**Ejemplo:** 12 defectos encontrados, 9 cerrados → **75 %**. 12 defectos ÷ 17 HU = **0,7 defectos por
HU**.

### M8 · Riesgos

**Qué mide:** qué puede afectar el proyecto y qué se está haciendo al respecto.

Para cada riesgo: **probabilidad** (1–5), **impacto** (1–5), **exposición** = probabilidad × impacto,
dueño, acción de mitigación y estado.

**Ejemplo (basado en lo que se ve en el repositorio y en el refinamiento del sprint 2):**

| Riesgo                                                                  | Prob. | Impacto | Exposición | Mitigación                                                |
| ----------------------------------------------------------------------- | :---: | :-----: | :--------: | --------------------------------------------------------- |
| La zona horaria desplaza los horarios de citas                          |   4   |    5    |     20     | Fijar zona horaria de Colombia y probarlo antes de HU-029 |
| Varias personas editan `panel/aliado/page.tsx` (2.000+ líneas) a la vez |   4   |    3    |     12     | Cada sección nueva en su propio componente                |
| Trabajo concentrado al final del sprint                                 |   3   |    4    |     12     | Integrar a `develop` a diario; revisar PR en 24 h         |
| Migraciones de base de datos con número repetido                        |   3   |    3    |     9      | Una sola persona numera las migraciones                   |
| Decisiones del PO sin confirmar (sección 9 de `historias-refinadas.md`) |   3   |    4    |     12     | Confirmarlas el primer día                                |

---

## 3. Métricas opcionales (si piden más)

| Métrica                      | Fórmula                                                            | Para qué                                   |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Cambios de alcance           | (HU agregadas + HU quitadas) ÷ HU comprometidas × 100              | Ver qué tanto se movió el plan             |
| Tiempo de ciclo              | Fecha en que la HU pasa a "Hecho" − fecha en que pasa a "En curso" | Ver cuánto tarda una HU y dónde se atasca  |
| Trabajo en curso (WIP)       | HU en "En curso" al mismo tiempo                                   | Demasiadas a la vez = poco se termina      |
| Aportes por persona          | PR mezclados y commits por integrante                              | Ver reparto (no usar para evaluar a nadie) |
| Cumplimiento de la ceremonia | Reuniones realizadas ÷ planeadas; asistencia                       | Si el curso evalúa la gestión de equipo    |
| Satisfacción del PO/cliente  | Encuesta corta de 1 a 5 al cierre del sprint                       | Calidad percibida                          |

> **Dato real sobre cambios de alcance:** el documento de modelo de datos fijó 55 HU esenciales, y en
> el sprint 1 se terminaron además HU que habían quedado fuera (HU-003 Google, HU-004 recuperar
> contraseña, HU-005 segundo factor, HU-023 confirmación de citas). Eso es un cambio de alcance y
> conviene reportarlo, con la razón y con quién lo aprobó.

---

## 4. De dónde sacar los datos

| Dato                          | Cómo obtenerlo                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| HU, estados, puntos, fechas   | Su tablero (GitHub Projects, Trello, Jira o una hoja). **Requisito:** cada HU con puntos, responsable, fecha de inicio y de cierre. |
| Pull requests mezclados       | `gh pr list --state merged --base develop --json number,title,createdAt,mergedAt,author`                                            |
| Ejecuciones de CI             | `gh run list --workflow CI --limit 200 --json conclusion,createdAt`                                                                 |
| Commits por semana            | `git log origin/develop --format='%ad' --date=format:'%Y-W%V' \| sort \| uniq -c`                                                   |
| Commits por persona           | `git shortlog -sn origin/develop`                                                                                                   |
| Commits de corrección (`fix`) | `git log origin/develop --oneline --grep='^fix' \| wc -l`                                                                           |
| Defectos                      | `gh issue list --label bug --state all --json number,createdAt,closedAt`                                                            |
| Horas                         | Hoja de cálculo compartida: fecha, persona, HU, horas, tipo de tarea                                                                |

**Sobre los commits por persona:** hoy hay personas con dos identidades de Git (por ejemplo
_David Guerrero_ y _David Santiago Guerrero_, o _DanielTrujillo01_ y _jose daniel trujillo suarez_).
Para contar bien, unifiquen con un archivo `.mailmap` en la raíz del repositorio o pídanle a cada
persona que configure siempre el mismo nombre y correo.

**Sobre los commits en general:** el número de commits o líneas de código es una métrica **débil**:
se puede inflar y no mide valor entregado. Úsenla como dato de apoyo, nunca como medida de
desempeño.

---

## 5. Plantilla del informe

Una estructura que cubre lo que suelen pedir (se llena cada sprint):

1. **Resumen ejecutivo** (5 líneas): estado general (verde / amarillo / rojo), qué se logró, qué falta, qué se necesita.
2. **Datos del periodo:** sprint, fechas, equipo, HU comprometidas.
3. **Tabla de métricas:**

   | Métrica                | Meta | Real | Semáforo | Comentario |
   | ---------------------- | ---- | ---- | :------: | ---------- |
   | M1 Avance del sprint   |      |      |          |            |
   | M2 Velocidad           |      |      |          |            |
   | M4 SPI                 |      |      |          |            |
   | M5 Desviación esfuerzo |      |      |          |            |
   | M6 Éxito del CI        |      |      |          |            |
   | M7 Defectos abiertos   |      |      |          |            |

4. **Gráficos:** burndown del sprint, velocidad por sprint (barras) y defectos abiertos vs. cerrados.
5. **Estado por historia:** HU, responsable, estado, % del DoD, observación.
6. **Cambios de alcance** y quién los aprobó.
7. **Riesgos:** matriz de la sección M8, con lo nuevo y lo cerrado.
8. **Problemas y acciones:** qué salió mal, causa y qué se hará (con responsable y fecha).
9. **Lecciones aprendidas** y **plan del siguiente sprint** (usando la velocidad para no sobrecomprometer).

---

## 6. Errores frecuentes

- Contar HU como terminadas sin cumplir el DoD completo.
- Calcular las métricas al final, de memoria: los datos (puntos pendientes por día, horas) se anotan
  **durante** el sprint.
- Cambiar la forma de estimar a mitad de proyecto y comparar sprints.
- Presentar números sin explicar qué significan ni qué decisión tomaron.
- Usar métricas para evaluar personas en lugar de al proceso.
- Reportar solo lo bueno: el informe sirve cuando muestra los atrasos y cómo se corrigen.
