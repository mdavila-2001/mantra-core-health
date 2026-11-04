# Mapa corporal · maniquí clínico 3D — evidencia

**Fecha:** 2026-10-23 / 24 · **Rama:** `justin/mockup-body-map-realista` (desde `origin/mockup` `355e01e98`)
**Pedido:** la silueta SVG gris del mapa corporal de `symptom-check` «está pésima»: el
propietario quiere algo hiperrealista. Decisiones del propietario: **maniquí clínico 3D**
(piel mate neutra, sin pezones ni genitales, apto para todo público) y **modelo MakeHuman
CC0**.

**Nivel de evidencia alcanzado: `VERIFIED` (rung 5) en `mockup`.** No llega a
`REGRESSION_VERIFIED`: ver «Lo que NO se corrió».

## Qué cambió

| Pieza | Antes | Ahora |
|---|---|---|
| Figura | Contorno SVG dibujado a mano + 2 degradados grises + líneas de detalle | Render de estudio (Blender 5.2, Cycles) de un maniquí MakeHuman, 9 WebP en `public/body-map/` |
| Zonas | Celdas sobre el contorno a mano | Las mismas costuras acordadas, **calzadas sobre la silueta real del render** (máscara alfa + puntos del esqueleto) |
| Sexo | Escalado de hombro/cintura/cadera | Tres maniquíes distintos: masculino, femenino y neutro (malla base) |
| `body-zones.geometry.ts` | 85 KB | 50 KB (sin `contorno`, `detalles`, `rellenos` ni `acentos`; con `image`) |

- `scripts/render-body-map.py` — **nuevo**. Lee `base.obj` y los targets de MakeHuman
  directamente (sin el complemento GPL), aplica la macro por sexo, borra pezones (superficie
  cuadrática ajustada al busto) y el relieve de la ingle (alisado local), baja los brazos 22°
  con los pesos del rig estándar y renderiza frente, espalda y cara con fondo transparente.
  Exporta los puntos anatómicos proyectados (`landmarks.json`).
- `scripts/gen-body-zones.py` — **reescrito**. Toma el render: la silueta sale de la máscara
  alfa; los brazos se separan por la abertura de la axila; las manos se cortan en la muñeca;
  las costuras del tronco se trasladan desde la lámina anterior por tramos entre marcas
  (coronilla, mentón, pezón, ombligo, entrepierna, rodilla, tobillo, planta); la cara escala
  por la distancia entre los ojos. Publica los WebP y escribe el `.ts`.
- `body-map.{ts,html,css}` — la imagen va como `<image>` del mismo SVG (mismo `viewBox`),
  decorativa (`aria-hidden`), debajo de las zonas. Se quitaron los degradados de volumen y
  luz y las capas de detalle. La elegida pasa a relleno translúcido (`fill-opacity: .62`)
  para que se siga viendo el cuerpo. En oscuro, el render baja a `brightness(.86)`.
  Accesibilidad, teclado, estados, marcador y «ningún estado sólo con color»: intactos.

### Procedencia y licencia

MakeHuman vía **MPFB2 v2.0.18**
(`https://github.com/makehumancommunity/mpfb2/archive/refs/tags/v2.0.18.tar.gz`,
descargado el 2026-10-23). Assets `src/mpfb/data/` bajo **CC0 1.0**
(`LICENSE.ASSETS.md`). El código del complemento (GPL-3) **no se usa ni se incluye**.

## Evidencia

### Compila y tipa — `RUNS`

```text
corepack yarn typecheck                    → exit 0
corepack yarn tsc -p tsconfig.spec.json --noEmit → exit 0
```

### Unitarias dirigidas — `TESTED`

```text
corepack yarn test --watch=false \
  --include='src/app/shared/components/organisms/body-map/**/*.spec.ts' \
  --include='src/app/features/symptom-check/**/*.spec.ts'

 Test Files  8 passed (8)
      Tests  186 passed (186)
```

Pruebas nuevas en `body-map.spec.ts`: cada vista trae su render publicado en `public/` y por
debajo de 150 KB; las tres proporciones usan imágenes distintas; el render se dibuja
decorativo y **antes** (debajo) de las zonas, y cambia con la vista y con el sexo.
`FRENTE` (orden del tabulador) se actualizó al orden nuevo, que sale por la misma regla
(centro de cada zona, de arriba abajo): brazos antes de estómago, manos antes de zona
íntima, rodillas antes de piernas.

### Navegador — `VERIFIED`

`playwright/body-map-realistic.spec.ts`, contra `corepack yarn dev --port 4291` (maqueta, sin
backend), Chromium, `--workers=1`:

```text
✓ neutro sin sesión: las tres vistas en 375, 768 y 1440 claro, y 1440 oscuro
✓ estados: apuntada, elegida y marcada por lo que se contó
✓ teclado: Tab recorre las zonas y Enter y la barra eligen sin mover la página
✓ con sesión female: el maniquí de su sexo en las tres vistas
✓ con sesión male: el maniquí de su sexo en las tres vistas
5 passed (14.7s)
```

Cada prueba comprueba que el WebP correcto se descarga y decodifica, que no hay scroll
horizontal, y que no hay errores de consola nuevos (ver abajo).

### Fotos

| | |
|---|---|
| Neutro, 1440 claro | `neutral-front-1440-light.png` · `neutral-back-1440-light.png` · `neutral-face-1440-light.png` |
| Neutro, 768 claro | `neutral-{front,back,face}-768-light.png` |
| Neutro, 375 claro | `neutral-{front,back,face}-375-light.png` |
| Neutro, 1440 oscuro | `neutral-{front,back,face}-1440-dark.png` |
| Femenino (Ana, CI 7654321) | `female-{front,back,face}-1440-light.png` |
| Masculino (Jorge, CI 5009871) | `male-{front,back,face}-1440-light.png` |
| Estados | `state-hover.png` · `state-selected.png` · `state-marked.png` · `keyboard-focus.png` |
| Página entera | `page-1440-light.png` |
| **Prueba de calce** | `fit/fit-{neutral,male,female}-{front,back,face}.svg`: el WebP publicado con las zonas reales de `body-zones.geometry.ts` delineadas y rotuladas encima |

**Antes:** la captura que mandó el propietario (silueta gris plana con «Estómago» en celeste).
Se perdió con el reinicio de la Mac (vivía en `/private/tmp`). La figura anterior se puede
reconstruir con `git show origin/mockup:src/app/shared/components/organisms/body-map/body-zones.geometry.ts`.

Revisión visual hecha a ojo sobre las fotos: el maniquí se lee en claro y en oscuro, las
costuras siguen visibles sin cortar la figura, la elegida se distingue por relleno, trazo,
marcador y texto, y la marcada por trazo punteado y leyenda.

### Errores de consola preexistentes (no se esconden)

`console-errors.json` guarda todo lo que se capturó. Dos errores **ya estaban antes de este
cambio** (el diff no toca `src/app/features/`, `src/server/` ni `src/index.html`) y la prueba
los deja pasar por lista explícita:

1. **PRODUCT_BUG preexistente:** sin sesión, `symptom-check` igual pide
   `GET /profiles/patients/me` y la maqueta responde 404 («No tiene perfil de paciente»).
   Pantalla principal con error de carga = bug a investigar (regla 55 §14). **Fuera del
   alcance de este PR.**
2. **ENVIRONMENT:** en `/auth`, el servidor de desarrollo bloquea por CSP dos scripts en línea.

## Lo que NO se corrió

- **Suite completa de unitarias** (`corepack yarn test --watch=false`, ~5 000 pruebas): la
  corrida se cortó porque la Mac se reinició por RAM. El propietario pidió después no lanzar
  suites ni builds pesados nuevos. **No corrida.**
- **`corepack yarn build`** (presupuestos de bundle incluidos): **no corrido.** El cambio
  agrega 9 WebP en `public/` (no entran al bundle) y achica el `.ts` de geometría de 85 a
  50 KB, que va en el chunk de `symptom-check`.
- **Ramas `test` y `dev`:** se llevan por cherry-pick. **Sin install, build ni Playwright en
  esas bases.** En `test` tampoco se corrió `ng build --configuration production-api`.
- **Regresión E2E del módulo** más allá de este spec: no corrida.

## Cómo rehacerlo

```bash
# 1. Bajar MPFB2 v2.0.18 (assets CC0) a una carpeta propia y renderizar (~4 min en GPU Metal)
blender -b -P scripts/render-body-map.py -- --mpfb <mpfb2>/src/mpfb/data --out <render>
# 2. Calzar zonas y publicar WebP (pillow, shapely, scikit-image)
python scripts/gen-body-zones.py --render <render> --overlay <carpeta de calce>
```
