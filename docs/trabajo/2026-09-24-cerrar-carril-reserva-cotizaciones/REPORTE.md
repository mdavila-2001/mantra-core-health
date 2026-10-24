> **AVANCE: 44 / 51 — 86,3 %.** ← 29 publicados + 15 de este cierre. 6 `DESCARTADO` (H4.S1.M1–M6, decisión de producto) no suman. 1 `A MEDIAS` cuenta como no hecha.

# Reporte — cerrar el carril «reserva y Cotizaciones» (2026-09-24)

- Plan: [PLAN.md](./PLAN.md) · Corte: `origin/mockup` @ `4daf00aa`, rebasado a `95472903` para
  los PRs · Rama: `justin/cerrar-carril-reserva-cotizaciones-2026-09-24`.
- Forma de trabajo: `CERRAR-EL-CARRIL-SIN-FRENOS.md` (AlovidaPromptManager, 2026-09-24).
- Cuenta: sólo `paciente@alovida.mock` y la profesional sintética «Valeria Rojas Mendoza»
  (`fixtures/personas.ts`). Ninguna captura muestra un médico real del catálogo de aseguradoras.
- **Doble revisión adversarial (regla 35.1):** 6 rondas, cada una por un agente distinto del que
  implementó, con la postura de rechazar. Las cinco primeras rechazaron con motivo real —la
  quinta por un solo defecto de encuadre en una captura (`encuadrar()` dejaba un renglón cortado
  en `cotizaciones-sin-ubicacion-390-*`)—; la sexta **aprobó** el set corregido, sin regresión.
  Detalle completo, hallazgo por hallazgo, en
  [`evidencia/doble-revision.md`](./evidencia/doble-revision.md).
- **Los seis PRs de código se fusionaron antes de terminar esta doble revisión** (#630–635,
  21:25 UTC del 2026-09-24): el estado que quedó en `mockup`/`dev` es el de H2+H3+H6 **sin** las
  correcciones de las rondas 1–5. Este cierre sale como **un PR nuevo** con esa diferencia
  (`justin/cierre-adversarial-reserva-cotizaciones-2026-09-24`), no como una actualización de los
  PRs ya fusionados.

## Completado

| ID | Qué quedó (observable) | Verificación |
|---|---|---|
| H1.S2.M1 | Recorrido Directorio → ficha con cupos medido: #610 y 10 muestras nuevas sobre el corte final | `evidencia/medicion/resumen.json` |
| H1.S2.M2 | Lecturas del «próximo hueco» contadas antes y después | `evidencia/medicion/lecturas-por-sede.md` |
| H2.S2.M1 | Q-J3 respondida: la API y el doble aceptan un solo `resourceId` | JSDoc de `practitioner-availability.ts` + PLAN |
| H2.S2.M2 | Todas las sedes se leen a la vez, una lectura por sede | spec, `HttpTestingController` |
| H2.S2.M3 | El «próximo hueco» sale de la misma lectura: de hasta 2N lecturas en dos tandas a N en una | spec |
| H2.S2.M4 | Carga y error por sede, con captura en los dos temas (reloj de Playwright en pausa) | spec + `evidencia/h6/ficha-buscando-turnos-por-sede-*`, `ficha-error-por-sede-*` |
| H2.S2.M6 | Con la latencia de Ender, la ficha con cupos tarda **992 ms** de mediana (Q-10: < 1 s) | `evidencia/medicion/resumen.json` |
| H3.S2.M2 | Origen elegible (casa / trabajo / ubicación actual); cambiarlo vuelve a consultar | spec + capturas |
| H3.S2.M3 | Tarjetas <780 px / tabla desde 780 px, con alto máximo y paginación en cliente; qué, dónde, precio, distancia y acción con ícono + texto | spec + capturas 390/768/1440 × claro/oscuro |
| H3.S2.M4 | Los seis estados (cargando, con datos, vacío, error, sin ubicación, precio no publicado) con captura en 390/768/1440 según el estado, en los dos temas | `evidencia/h6/` (55 capturas) |
| H5.S1.M1 | Lint 249 = 249 contra la base, 0 en el diff; typecheck exit 0 | `evidencia/gates.md` |
| H5.S1.M2 | Suite completa: el único rojo final (`mock-backend-latencia`) ya estaba en la base | `evidencia/gates.md` |
| H6.S1.M3 | Brechas declaradas | §Brechas |
| H6.S1.M4 | Peldaño por área | §Peldaño |
| H6.S1.M5 | Este reporte, con el avance en la primera línea | `head -3 REPORTE.md` |

### Lo que cambió en el producto

1. **Ficha del médico (R-02).** Una lectura de cupos por sede, todas en paralelo, que cubre la
   semana visible y el horizonte del próximo hueco. Cada sede muestra su propia carga («Buscando
   turnos en …», `role="status"`) y su propio error con «Reintentar» (ícono + texto); una
   respuesta vieja no pisa la semana nueva.
2. **Cotizaciones del paciente (N-02).** Antes era una lista fija de cuatro filas con importes
   escritos en el código («Paracetamol 12 BOB»). Ahora compone tres fuentes existentes y no tiene
   un solo número en el código:
   - **Medicamentos:** `GET /pharmacy/products` → `GET /pharmacy-inventory/availability`. Precio
     de la lista de cada sede y distancia calculada por la API desde el origen.
   - **Análisis e Imagenología:** `GET /diagnostic-units/search` → `GET /diagnostic-units/:id`,
     con el tarifario del estudio.
   - **Servicios médicos:** `GET /billing/service-catalog/procedures`, con el arancel de
     referencia en su unidad. UMA va rotulado «Colegio Médico de Santa Cruz 2025» y **nunca se
     convierte**.

   Estados: sin término, cargando, con datos, vacío (con su propio título y «Limpiar la
   búsqueda»), error con «Reintentar», sin ubicación (con acción propia), precio no publicado
   (dice quién no lo publicó, distinto por fuente) y fuente caída con «Volver a consultar».
   Debajo de 780 px los resultados son tarjetas; desde 780 px, tabla.
3. **Doble de farmacia.** Leía `productIds`, pero el contrato y el cliente usan `products`, así
   que en la maqueta la disponibilidad no filtraba nada. Además, sin origen inventaba kilómetros
   desde un punto fijo. Ahora lee `products` y devuelve `distanceKm: null` sin origen, como la API.
4. **Procedencia sin atribución falsa.** La primera versión decía «publicado por <sede>» para
   precios que en realidad son de ejemplo del doble: quedaba una institución con nombre real
   («Farmacia Chávez», «DIACOR S.A.») presentada como si hubiera publicado un precio inventado
   (regla 00 §2.1). Corregido a «Precio/Tarifario de ejemplo de la maqueta: <sede> no lo
   publicó» (con el backend real diría «publicado por <sede>»); el subtítulo de la pantalla lo
   declara arriba de todo cuando corre contra el mockup. El arancel de servicios médicos **no**
   lleva esa marca: es la tabla real del Colegio Médico (`fee-schedules.generated.ts`), no un dato
   del doble.

### La medición

| Corte | Mediana (10 muestras) | Rango |
|---|---|---|
| antes, `b7785e36` (#610) | 1428 ms | 1285–1566 |
| después de #583/Ender, `a43ad2b3` (#610) | 1108 ms | 914–1448 (n=10) |
| **final, esta rama** | **992 ms** | 853–2678 (la 2678 es la primera muestra tras levantar `ng serve`) |

Mismo instrumento que #610 (`baseline-comparable-reserva.spec.ts`, «hasta los cupos», cuatro
activaciones → **1 navegación** en las 10 muestras). La mejora de 1108 a 992 ms **no se adjudica
sólo a este carril**: el corte final trae también todo lo fusionado en `mockup` desde `a43ad2b3`.

> **Corrección de lo publicado.** El daily de Justin y el §4-bis del daily de equipo dicen
> «1691 → 1163 ms» para el escenario de cupos. Esas medianas son del set de muestras anterior
> a la tercera revisión de #610. Las del `resumen.json` de #610 son **1428 → 1108 ms**; en el
> camino por defecto, **1460 → 892 ms**.

## A medias

- **H2.S2.M5 — «después» ≤ 50 % de «antes».**
  1. *Qué anda:* 1428 → 992 ms (−31 %) y de hasta 2N lecturas a N.
  2. *Qué no anda:* no llega al −50 % que pide el criterio.
  3. *Qué falta:* lo que queda del tiempo **no son peticiones**: hay 0 de negocio en la Red, y la
     latencia del doble es de 40 ms fijos. Es carga de chunks y render de la ficha. Bajarlo pide
     perfilar el render o precargar el chunk de la ficha desde el directorio, fuera de estos 16 IDs.
  4. *Dónde quedó:* medición en `evidencia/medicion/`.

## Pendiente

| Qué | Estado | Qué falta y de quién depende |
|---|---|---|
| Bajar la ficha a ≤ 50 % (H2.S2.M5) | `A MEDIAS` | Perfilar render o precargar el chunk. Decisión de alcance: **Pablo** |
| Precios con procedencia real de análisis e imagenología (Q-16) | `DECISION_REQUIRED` | Negocio. Ver §Brechas |

## Brechas

- **Precios del simulador (Q-16).** La pantalla muestra lo que la fuente publica, con su
  procedencia, pero en la maqueta esas fuentes son dobles, y se declaran «de ejemplo de la
  maqueta» en cada fila y en el subtítulo de la pantalla:
  - **Diagnóstico:** el precio de cada estudio lo calcula una fórmula sintética del doble
    (`45 + (i % 12) × 30` en `diagnostics.handlers.ts`), con tarifarios `MAQUETA`/`PUBLICO`. **No
    son precios reales.**
  - **Farmacias:** son precios de maqueta.

  Contra la API real, lo que no esté publicado va a decir «Precio no publicado»; lo que sí esté
  publicado diría «publicado por <sede>», sin la marca de ejemplo.
- **UMA** nunca se convierte; ordenar por precio compara sólo dentro de la misma unidad. El
  arancel en UMA es la tabla real del Colegio Médico (OCR del PDF; algunas filas llevan
  advertencia de escaneo), no un dato del doble.
- **Distancia de análisis e imagenología:** `null`. El contrato de `diagnostic-units` no trae
  coordenadas del centro, y `public/nearby` no expone el id del centro para cruzarlo, a propósito
  según su tipo. Se dice «No disponible: el directorio de centros no trae su ubicación».
- **Arancel para el paciente:** `GET /billing/service-catalog/procedures` responde en el doble. No
  se verificó contra la API real que el rol `PATIENT` pueda leerlo.
- **Q-J1 / H4:** descartado por producto; Cotizaciones no muestra documentos personales (lo fija
  el spec «no carga estudios personales dentro del comparador»).
- **Dobles:** no se agregó ningún manejador nuevo. Se corrigió el de disponibilidad de farmacia
  (parámetro y distancia sin origen) y el armado de «sede» para no repetir el nombre cuando la
  farmacia ya incluye la sucursal.
- **WCAG AA — foco visible, no cumplido (hallazgo de otro dueño, escalado acá).** El anillo de
  foco de la acción y del cupo, medido en el navegador (`teclado.md`), da **1,48:1** contra el
  fondo — por debajo de 3:1 (WCAG 1.4.11). Es `--focus-ring: rgba(79, 179, 169, 0.45)`, un token
  **global** de `src/styles.css:217` (y su variante oscura en `:280`/`:324`): afecta a toda la
  aplicación, no algo que este carril introdujo ni pueda corregir sin tocar el sistema de diseño
  (regla 95.1.5). El criterio «WCAG AA» del carril queda **no cumplido en el foco visible**;
  el resto de accesibilidad revisado (nombre accesible, teclado, `role="status"`) sí se cumple.
  Corresponde al dueño del sistema de diseño.
- **Instituciones reales en la ficha sintética (hallazgo de otro dueño, escalado acá).** La ficha
  de la profesional sintética muestra «Verificado» sobre «Colegio Médico de Bolivia» y
  «Universidad Mayor de San Andrés» — instituciones reales avalando una credencial sintética. Es
  preexistente (no lo introdujo este carril) y vive en el componente de credenciales del perfil
  médico, no en `cotizaciones/` ni en `practitioner-availability/`.

## Peldaño por área (regla 30)

| Área | Peldaño | Por qué no más |
|---|---|---|
| Ficha del médico, lecturas por sede | `REGRESSION_VERIFIED` contra el doble, con doble revisión visual (5 rondas) | Sin API real |
| Cotizaciones del paciente | `REGRESSION_VERIFIED` contra el doble, con doble revisión visual (5 rondas) | Sin API real; foco visible por debajo de AA (token global, otro dueño) |
| Doble de disponibilidad de farmacia | `TESTED` (104 tests de sus consumidores) | — |

## No cubierto

- **API real:** todo se verificó contra el simulador del mockup.
- **Foco visible bajo AA:** ver §Brechas. No se corrigió porque el token es global y su dueño es
  el sistema de diseño, no este carril.
- **Contraste de `app-link` en el tema oscuro de AloVida:** el primer intento de esta pantalla
  tropezó con el mismo defecto (`a[app-link] { color: var(--petroleo) }` global, ≈ 3,4:1 en
  oscuro) y se corrigió **localmente** para la acción de Cotizaciones (`--brand-primary`, 8,03:1
  claro / 8,77:1 oscuro, medido en el navegador). El defecto de fondo sigue en todos los demás
  enlaces del producto; queda anotado para el barrido del puerto ALOVIDA, como ya lo anota
  `login.css`.

## Procesos

`ng serve` en :4200, levantado para las capturas y la medición, se cierra al terminar. No queda
ningún otro proceso del carril.
