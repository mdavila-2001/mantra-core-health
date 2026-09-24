> **AVANCE: 42 / 51 — 82,4 %.** ← 29 publicados + 13 de este cierre. 6 `DESCARTADO` (H4.S1.M1–M6, decisión de producto) no suman. 3 `A MEDIAS` cuentan como no hechas.

# Reporte — cerrar el carril «reserva y Cotizaciones» (2026-09-24)

- Plan: [PLAN.md](./PLAN.md) · Corte: `origin/mockup` @ `4daf00aa` · Rama:
  `justin/cerrar-carril-reserva-cotizaciones-2026-09-24`.
- Forma de trabajo: `CERRAR-EL-CARRIL-SIN-FRENOS.md` (AlovidaPromptManager, 2026-09-24).
- Cuenta: sólo `paciente@alovida.mock` y la profesional sintética «Valeria Rojas Mendoza»
  (`fixtures/personas.ts`). Ninguna captura muestra un médico real del catálogo de aseguradoras.

## Completado

| ID | Qué quedó (observable) | Verificación |
|---|---|---|
| H1.S2.M1 | Recorrido Directorio → ficha con cupos medido: #610 y 10 muestras nuevas sobre el corte final | `evidencia/medicion/resumen.json` |
| H1.S2.M2 | Lecturas del «próximo hueco» contadas antes y después | `evidencia/medicion/lecturas-por-sede.md` |
| H2.S2.M1 | Q-J3 respondida: la API y el doble aceptan un solo `resourceId` | JSDoc de `practitioner-availability.ts` + PLAN |
| H2.S2.M2 | Todas las sedes se leen a la vez, una lectura por sede | spec, `HttpTestingController` |
| H2.S2.M3 | El «próximo hueco» sale de la misma lectura: de hasta 2N lecturas en dos tandas a N en una | spec |
| H2.S2.M6 | Con la latencia de Ender, la ficha con cupos tarda **992 ms** de mediana (Q-10: < 1 s) | `evidencia/medicion/resumen.json` |
| H3.S2.M2 | Origen elegible (casa / trabajo / ubicación actual); cambiarlo vuelve a consultar | spec + capturas |
| H3.S2.M3 | Tabla con alto máximo y paginación en cliente; qué, dónde, precio, distancia y acción con ícono + texto | spec + 6 capturas 390/768/1440 × claro/oscuro |
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

   Estados: sin término, cargando, con datos, vacío, error con reintento, sin ubicación, precio no
   publicado (dice quién no lo publicó) y fuente caída con «Todas».
3. **Doble de farmacia.** Leía `productIds`, pero el contrato y el cliente usan `products`, así
   que en la maqueta la disponibilidad no filtraba nada. Además, sin origen inventaba kilómetros
   desde un punto fijo. Ahora lee `products` y devuelve `distanceKm: null` sin origen, como la API.

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

- **H2.S2.M4 — carga por sede.**
  1. *Qué anda:* cada sede muestra «Buscando turnos en …» con `role="status"` mientras su lectura
     viaja, y su propio error con «Reintentar». Lo fijan dos tests del componente.
  2. *Qué no anda:* no hay captura del estado de carga. Dura lo que la latencia del doble (40 ms)
     y está bajo el pliegue. Tres intentos: frenar la CPU 20×/60× y usar un viewport alto. Uno
     produjo una foto rotulada «buscando» que mostraba cupos, y **se descartó**.
  3. *Qué falta:* una forma de retener la respuesta del doble en una prueba de navegador, por
     ejemplo un parámetro de latencia del simulador (archivo de Ender).
  4. *Dónde quedó:* specs verdes; la captura del estado final por sede está en
     `evidencia/h6/ficha-cupos-por-sede-*`.
- **H2.S2.M5 — «después» ≤ 50 % de «antes».**
  1. *Qué anda:* 1428 → 992 ms (−31 %) y de hasta 2N lecturas a N.
  2. *Qué no anda:* no llega al −50 % que pide el criterio.
  3. *Qué falta:* lo que queda del tiempo **no son peticiones**: hay 0 de negocio en la Red, y la
     latencia del doble es de 40 ms fijos. Es carga de chunks y render de la ficha. Bajarlo pide
     perfilar el render o precargar el chunk de la ficha desde el directorio, fuera de estos 16 IDs.
  4. *Dónde quedó:* medición en `evidencia/medicion/`.
- **H3.S2.M4 — los seis estados, observados en captura.**
  1. *Qué anda:* los seis están implementados y fijados en `cotizaciones.spec.ts`. Cuatro tienen
     captura: con datos, vacío, cargando y precio no publicado.
  2. *Qué no anda:* no hay captura de «error» ni de «sin ubicación».
  3. *Qué falta:* el simulador no tiene forma de forzar un fallo. Y `paciente@alovida.mock` tiene
     casa guardada, así que el selector de origen arranca con un origen y «sin ubicación» no se
     alcanza con esta cuenta. Hace falta una cuenta de prueba sin lugares guardados, o un
     conmutador de fallos en el simulador (archivos de Ender).
  4. *Dónde quedó:* specs verdes; capturas de los otros cuatro en `evidencia/h6/`.

## Pendiente

| Qué | Estado | Qué falta y de quién depende |
|---|---|---|
| Captura de «error» y «sin ubicación» (H3.S2.M4) y de la carga por sede (H2.S2.M4) | `A MEDIAS` | Conmutador de fallos / latencia en el simulador, o cuenta sin lugares guardados. **Ender** (dueño del interceptor y los fixtures) |
| Bajar la ficha a ≤ 50 % (H2.S2.M5) | `A MEDIAS` | Perfilar render o precargar el chunk. Decisión de alcance: **Pablo** |
| Precios con procedencia real de análisis e imagenología (Q-16) | `DECISION_REQUIRED` | Negocio. Ver §Brechas |

## Brechas

- **Precios del simulador (Q-16).** La pantalla muestra lo que la fuente publica, con su
  procedencia, pero en la maqueta esas fuentes son dobles:
  - **Diagnóstico:** el precio de cada estudio lo calcula una fórmula sintética del doble
    (`45 + (i % 12) × 30` en `diagnostics.handlers.ts`), con tarifarios `MAQUETA`/`PUBLICO`. **No
    son precios reales.**
  - **Farmacias:** son precios de maqueta.

  Contra la API real, lo que no esté publicado va a decir «Precio no publicado».
- **UMA** nunca se convierte; ordenar por precio compara sólo dentro de la misma unidad.
- **Distancia de análisis e imagenología:** `null`. El contrato de `diagnostic-units` no trae
  coordenadas del centro, y `public/nearby` no expone el id del centro para cruzarlo, a propósito
  según su tipo. Se dice «El centro no publica su ubicación en el directorio».
- **Arancel para el paciente:** `GET /billing/service-catalog/procedures` responde en el doble. No
  se verificó contra la API real que el rol `PATIENT` pueda leerlo.
- **Q-J1 / H4:** descartado por producto; Cotizaciones no muestra documentos personales (lo fija
  el spec «no carga estudios personales dentro del comparador»).
- **Dobles:** no se agregó ningún manejador nuevo. Se corrigió el de disponibilidad de farmacia
  (parámetro y distancia sin origen).

## Peldaño por área (regla 30)

| Área | Peldaño | Por qué no más |
|---|---|---|
| Ficha del médico, lecturas por sede | `REGRESSION_VERIFIED` contra el doble | Sin API real ni captura del estado de carga |
| Cotizaciones del paciente | `REGRESSION_VERIFIED` contra el doble | Sin API real; 2 de 6 estados sin captura |
| Doble de disponibilidad de farmacia | `TESTED` (104 tests de sus consumidores) | — |

## No cubierto

- **API real:** todo se verificó contra el simulador del mockup.
- **Revisión adversarial por otro agente (regla 35.1):** no se hizo. Las capturas se miraron una
  por una y esa pasada encontró y corrigió tres defectos: un médico real en una captura de fallo,
  una captura «buscando» que mostraba cupos y «la sede no publicó» en una fila de arancel. Pero
  quien implementó no puede aprobar su propio trabajo.
- **Contraste de `app-link` en el tema oscuro de AloVida:** ≈ 3,4:1, en todos los enlaces del
  producto. Es un átomo compartido y queda fuera del carril; está anotado en el PLAN.

## Procesos

`ng serve` en :4200, levantado para las capturas y la medición, se cierra al terminar. No queda
ningún otro proceso del carril.
