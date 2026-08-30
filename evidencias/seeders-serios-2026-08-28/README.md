# Seeders serios: trayectoria completa, publicaciones y movimiento real

**28/08/2026.** Qué se pidió: que los seeders dejaran de ser flojos —universidades
bolivianas, trayectoria detallada, y publicaciones con imagen, comentarios y
reacciones de usuarios con los que se pueda entrar de verdad—, y que además se
sanearan los datos que ya estaban.

Todo lo de acá se escribió **por la API real**, con sus guards y validaciones.
No hay una sola fila insertada a mano en la base: los contadores de reacciones y
comentarios se calculan contando filas, y cada fila exige un perfil titular que
la firme (`assertActsAsProfile`), así que no se pueden falsear.

## Los números, verificados contra la base y contra la API pública

`verificacion-base-de-datos.txt` — consulta directa a Postgres:

| dato | valor |
| --- | --- |
| publicaciones en `community.social_posts` | 283 |
| comentarios en `community.comments` | 569 |
| reacciones en `community.reactions` | 4 763 |
| publicaciones públicas sin ningún comentario | 0 (las 9 que aparecen son posts huérfanos sin vitrina, invisibles en el feed) |
| etapas de trayectoria en `profiles.practitioner_affiliations` | 179 |
| especialidades publicadas en `VS_MEDICAL_SPECIALTY` | 36 |

`verificacion-feed-publico.txt` — `GET /public/posts?limit=50`, que es el tope
del endpoint:

```
publicaciones devueltas      : 50
con imagen                   : 50
con >=2 comentarios          : 50
con >=1 reacción             : 50
reacciones  min / max / prom : 17 / 35 / 25.7
comentarios min / max        : 2 / 3
```

De esas, **60 son de esta corrida** (`corrida-seed-vitrina.log`): 15
profesionales × 4 publicaciones, todas con imagen, dos comentarios propios de su
tema y una respuesta del autor en una de cada tres.

## Las capturas

| archivo | qué prueba |
| --- | --- |
| `capturas/01-ficha-publica-completa.png` | La ficha de Marisol Quispe: foto, portada, chip de especialidad, **trayectoria de siete etapas** (UMSA → internado en Hospital de Clínicas → SAFCI rural en Achacachi → residencia en el Hospital Obrero N.º 1 → formación en el Instituto Nacional de Tórax → planta en Clínica del Sur → docencia en la UMSA) y sus cuatro publicaciones con 12, 21, 18 y 14 reacciones y 2–3 comentarios. |
| `capturas/02-guia-profesionales-por-especialidad.png` | La guía de profesionales con los chips de especialidad ya poblados. Ver el pendiente al final. |
| `capturas/03-feed-publico-con-movimiento.png` | `/publicaciones`: la portada pública con avatar, imágenes y el bloque de interacción visible (17 reacciones, 2 comentarios). |
| `capturas/04-vecina-rosario-choque-con-sesion.png` | Rosario Choque entrando con su documento (`CI 4821337wl`) y su panel de paciente. Las cuentas que comentan **existen y se puede entrar con ellas**. |
| `capturas/05-publicacion-con-comentarios.png` | El enlace permanente de una publicación, con sus contadores. |

`ficha-publica-marisol-quispe.json` es la respuesta cruda de `GET /p/{slug}` que
sostiene la primera captura.

Los comentarios, leídos con la sesión de la vecina que los escribió
(`GET /community/posts/{id}/comments`), incluyen hilos de dos niveles:

```
"Doctora, me pidieron Holter y trabajo manejando. ¿Puedo trabajar con el aparato puesto?"
  └─ (respuesta de Marisol Quispe) "Exacto. Y ojo, que es más común de lo que parece: lo veo varias veces por semana."
"A mí el electro me salió normal y yo seguía sintiendo los saltos. Recién con el Holter apareció…"
```

## Qué se cambió

En `mantra-core-health-api`:

- `tools/redesa/datos/elenco-medico.mjs` **(nuevo)** — 15 profesionales con su
  trayectoria completa: pregrado, internado rotatorio, SSSRO, residencia,
  posgrado, ejercicio actual y docencia. Universidades reales del sistema
  boliviano (UMSA, UMSS, UAGRM, USFX, UAJMS, UCB San Pablo, UNIVALLE, UDABOL,
  UPEA…) y hospitales reales.
- `tools/redesa/datos/publicaciones.mjs` **(nuevo)** — 60 publicaciones de
  divulgación, cuatro por especialidad, de dos a cuatro párrafos.
- `tools/redesa/datos/comunidad.mjs` **(nuevo)** — 16 vecinos con documento y
  contraseña, 120 comentarios escritos contra su publicación y un pool general
  para sanear lo viejo.
- `tools/redesa/seed-vitrina-publica.mjs` — pasada de interacción, reintento
  ante `429`, y `--solo-interaccion` para completar lo ya sembrado sin duplicar.
- `src/common/seed/clinical-forms-seed.service.ts` — publica
  `VS_MEDICAL_SPECIALTY` **sólo cuando el paquete del modelo no lo trajo**. Sin
  esto, `POST /profiles/practitioners/{id}/specialties` respondía 422 («El
  catálogo de especialidades médicas no está disponible») y **ningún**
  profesional de este entorno podía declarar su especialidad. 23/23 pruebas del
  seed en verde, con tres nuevas que fijan que no pisa el catálogo del modelo.

## Lo que sigue pendiente, y por qué no se resolvió acá

- **100 publicaciones viejas siguen sin imagen.** No hay endpoint para editar
  una publicación ya creada: el contrato de `community` es de sólo alta. Se les
  sembraron comentarios y reacciones, que sí se pueden agregar después.
- **La guía agrupa por el titular, no por la especialidad.**
  `PublicSearchResultDto` no expone `specialty`, así que
  `/buscar/profesionales` agrupa por el texto de `headline` y los profesionales
  nuevos caen en grupos separados de los viejos. Ahora que las especialidades
  **sí** están asignadas, arreglarlo es agregar el campo al DTO de búsqueda y
  reagrupar la pantalla — es trabajo de contrato y de front, no del seeder.
- **La superficie pública muestra los comentarios como número, no como texto.**
  `GET /p/{slug}` devuelve `commentCount`; el cuerpo de cada comentario sólo se
  lee con sesión. Es una decisión del contrato actual, no un dato faltante.
