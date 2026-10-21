# Contexto de producto y marketing — AloVida

> Documento base que leen las skills de `.claude/skills/` (`copywriting`,
> `copy-editing`, `cro`, `signup`, `onboarding`, `popups`, `launch`, `aso`…).
> Formato de la skill `product-marketing`; vive en `docs/` y no en
> `.agents/` porque este repo documenta ahí.
>
> **Regla de este archivo:** solo entra lo que tiene fuente. Lo que no se sabe
> queda como **[POR CONFIRMAR → quién]**. Nada de cifras, clientes ni
> testimonios inventados (regla 00 §2 y `anti-hallucination-guard`).
>
> **Límite que ninguna skill de marketing puede cruzar:** la conversión nunca
> pasa por encima de la privacidad clínica ni de la autorización. La autoridad
> es la API (`CLAUDE.md`, punto 2).

- **Versión del documento:** 1.0 · 2026-10-21
- **Changelog:** 1.0 — primera versión, redactada desde el código y desde las
  capturas reales a 390 px del trabajo `2026-10-21-movil-paridad-estetica`.

## 1. Producto

| | |
|---|---|
| Nombre en la interfaz | **AloVida** (marca visible) · **Mantra Core Health** (nombre del producto; no se renombra hasta que el cliente lo confirme — `identidad-visual.md`) |
| En una línea | Plataforma de salud para Bolivia que reúne la historia clínica, los turnos y los estudios de la persona con la red de profesionales y centros. Fuente: «Tu salud, conectada» y «Sumate a la red de salud más grande de Bolivia» (`register-patient`). |
| Qué hace (lo que se ve en pantalla) | La persona busca a quién ver (cuerpo interactivo → especialidad), reserva y reprograma turnos, consulta su historia, recetas y estudios, chatea con su profesional y con soporte, y recorre directorios de médicos, laboratorios, clínicas y farmacias. El profesional atiende, receta y lleva su agenda. Las organizaciones (aseguradoras, laboratorios, imagenología) administran su padrón y reciben órdenes de la red. |
| Categoría | Plataforma de salud / historia clínica y turnos. |
| Tipo | Aplicación web (Angular, SSR) y app móvil (Flutter, en construcción). |
| Modelo de negocio y precios | **[POR CONFIRMAR → Marcelo]** No hay precios en el producto. Hay una pantalla de cotizaciones y planes de aseguradoras; su política comercial no está documentada. |

## 2. Audiencia

Cinco tipos de cuenta en el registro (`/auth/register`), con la promesa que la
propia pantalla les hace:

| Cuenta | Promesa verbatim en pantalla |
|---|---|
| Paciente | «Tu historia clínica, tus turnos y tus estudios, siempre con vos.» |
| Médico | «Atendé, recetá y llevá tu agenda. Necesitás matrícula y colegio.» |
| Aseguradora | «Registrá tu organización y administrá el padrón de tus afiliados.» |
| Laboratorio | «Recibí las órdenes médicas de la red y entregá los resultados por la app.» |
| Imagenología | «Rayos X, ecografía, tomografía y resonancia. Recibí las órdenes de la red.» |

- Trabajos que se le encargan al producto: (1) saber a qué especialidad ir
  cuando algo duele; (2) tener a mano turnos, recetas y resultados; (3) que el
  profesional y las organizaciones trabajen sobre la misma historia.
- Mercado: Bolivia. **[POR CONFIRMAR → Marcelo]** ciudades/regiones objetivo,
  tamaño de red, segmento principal para el lanzamiento.

## 3. Problemas que resuelve

Solo lo que el producto dice de sí mismo; la investigación con usuarios reales
**[POR CONFIRMAR → Marcelo]** no existe en el repo.

- Una persona con un síntoma no sabe qué especialidad consultar → «Tocá en la
  figura dónde te pasa… y te decimos a qué especialidad ir.» (con la salvedad
  «Esto no es un diagnóstico: orienta sobre a qué especialidad consultar.»)
- La historia clínica se mezcla entre personas parecidas → «Es lo que evita que
  tu historia clínica se mezcle con la de alguien que se llama parecido.»
- Turnos que se pierden o no se pueden reprogramar → panel «Tu próxima cita» con
  «Ver o reprogramar».

## 4. Competencia y diferenciación

**[POR CONFIRMAR → Marcelo]** No hay análisis de competidores en el repo. No se
afirma ninguna diferencia frente a terceros. Las diferencias que el producto
sí sostiene, por evidencia en código:

- Red única que conecta paciente, profesional, laboratorio, imagenología y
  aseguradora sobre una misma historia.
- Privacidad declarada y verificable: «Tu información clínica la ve el
  profesional que te atiende, nadie más» y «No vendemos tus datos ni los usamos
  para publicidad». **Estas dos frases son promesas legales**: antes de
  reutilizarlas en cualquier canal, confirmar con quien responda por
  cumplimiento **[→ Marcelo / responsable legal]**.
- Verificación de identidad y de matrícula del profesional.

## 5. Objeciones y anti-persona

- «¿Mis datos están seguros?» → responder con los cuatro compromisos que la
  pantalla de registro ya enumera («Todo lo que escribís viaja cifrado…»,
  «Podés corregirlos cuando quieras desde tu perfil»). No agregar garantías que
  el producto no cumpla.
- «¿Es un diagnóstico?» → no. Se dice siempre, con esas palabras.
- Anti-persona: **[POR CONFIRMAR → Marcelo]**.

## 6. Lenguaje del cliente y glosario

Trato: **voseo** («Ingresá», «Creá», «Escribí», «Podés»), tuteo prohibido en
textos nuevos para no mezclar registros. Términos del producto: *turno* (no
«cita» en textos de paciente, aunque el panel usa «Tu próxima cita» — ver
Hallazgos), *historia clínica*, *receta*, *estudios*, *red*, *profesional*.
Palabras a evitar: «paciente» como etiqueta fría en titulares dirigidos a la
persona; jerga («onboarding», «tenant», «token») en cualquier texto visible.

## 7. Voz de marca

Extraída de textos que ya están en pantalla, no de adjetivos elegidos en una
reunión:

| Atributo | Qué es | Qué no es | Línea real |
|---|---|---|---|
| Cercana y directa | Voseo, frases cortas, verbo primero | Infantil o con signos de exclamación seguidos | «Ingresá con tu correo o tu documento de identidad.» |
| Honesta con lo clínico | Dice lo que el producto no es | Promete resultados médicos | «Esto no es un diagnóstico: orienta sobre a qué especialidad consultar.» |
| Concreta | Nombra la acción y el destino | «Gestioná tu experiencia de salud» | «Ver y descargar» · «Ver o reprogramar» |
| Tranquila ante el error | Dice qué pasó y qué hacer | Culpa a la persona o tecnicismos | «No pudimos mostrar esta pantalla. Suele resolverse recargando.» |

Tono por contexto: **errores** — sin dramatismo, con la acción primero;
**registro** — explica para qué se pide cada dato; **clínico** (resultados,
dosis) — sin adornos ni énfasis comercial; **lanzamientos** — sobrio, sin
superlativos no comprobables.

## 8. Pruebas (proof points)

**[POR CONFIRMAR → Marcelo]** No hay métricas, logos de clientes ni testimonios
en el repo. Mientras no existan, ninguna pantalla ni ficha de tienda cita
cifras. «La red de salud más grande de Bolivia» es una afirmación comparativa
que hoy está en `register-patient` y **no tiene evidencia en el repo**: marcarla
para revisión.

## 9. Objetivos y acción de conversión

- Acción clave por audiencia: paciente → completar el registro y reservar su
  primer turno; profesional → completar registro con matrícula y verificación;
  organización → registrar la organización.
- Métricas actuales: **[POR CONFIRMAR]**. La captura de interacciones para
  mapas de calor existe pero está detrás de consentimiento y sin esquema
  provisionado (`docs/trabajo/2026-10-21-mapa-de-calor-ux`).

## 10. Aprendizajes

(vacío — se llena al publicar cambios; cada entrada con fecha, qué se cambió,
qué se midió y con qué evidencia.)

## Fuentes

`docs/business/*` (parcialmente desactualizado: habla de 8 pantallas; el
catálogo actual tiene 62 secciones y 110 rutas hijas), textos de
`features/auth/*`, capturas `evidencia/01-antes/` de este trabajo,
`docs/refactor-profesional/`.
