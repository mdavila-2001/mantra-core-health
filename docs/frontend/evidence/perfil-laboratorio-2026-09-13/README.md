# Perfil del laboratorio con la disciplina de «Mis servicios» — 13/09/2026

Pantalla: `/administration/medical-laboratory` (`features/admin/medical-laboratory`).
Referencia: `/my-services` (`features/my-services`).

El commit `91f10dc6` ya había sacado la **tarjeta** a dos hojas compartidas
(`shared/styles/rejilla-de-tarjetas.css` y `tarjeta-de-servicio.css`). Lo que
quedaba distinto era todo lo que rodea a la tarjeta, y era lo que se veía mal.

## Qué cambió

| | Antes | Ahora |
|---|---|---|
| Selector de unidad | `<select>` nativo con `<label>` al costado y CSS propio | `app-form-field` + `app-select`, igual que «Práctica» |
| Ficha del laboratorio | losa gris sin título colgada del `page-header` | `app-card` + `app-section-heading` «Identificación», igual que el perfil público del lab |
| Importe de la tarjeta | `40.00 Boliviano PUBLICO`, rótulo en su propio renglón | `Precio 40.00 BOB PUBLICO` en un solo renglón de base, moneda por **código** |
| Varios importes | siempre apilados | apilados sólo cuando hay más de uno |
| Acción de la tarjeta | botón rojo `danger` repetido en 13 tarjetas | `outline`/`sm`, igual que «Editar precio» — el diálogo sigue siendo `destructive` |
| «Qué administra esta pantalla y qué no» | nueve párrafos abiertos al pie | dentro de un `app-accordion`, cerrado de entrada |

## Paridad, medida en el navegador (no leída del código)

Anatomía de una tarjeta, `[...tarjeta.querySelectorAll('*')].map(e => e.className)`:

```text
Mis servicios  rejilla__icono · tarjeta-servicio__ficha · rejilla__nombre · rejilla__dato ·
               tarjeta-servicio__precio · __rotulo · __monto · __acciones · btn btn--outline btn--sm
Laboratorio    rejilla__icono · tarjeta-servicio__ficha · rejilla__nombre · rejilla__dato ·
               tarjeta-servicio__precio · __rotulo · __monto · __tarifario · __acciones · btn btn--outline btn--sm
```

La única pieza que el laboratorio agrega es `tarjeta-servicio__tarifario`: el
código del tarifario al que pertenece el importe, que «Mis servicios» no tiene
porque el precio de referencia del médico no vive dentro de ninguno.

## Verificación

- `corepack yarn typecheck` → exit 0
- `corepack yarn build` → exit 0
- `corepack yarn test --watch=false --include='**/medical-laboratory.spec.ts'` → **32/32**
- `corepack yarn test --watch=false` (suite completa) → **5 744/5 745**. El único
  rojo es `src/app/core/mock/fixtures/fichas-estandar.spec.ts`
  (`PLANTILLAS_DE_EXPEDIENTE.length` != `FICHAS_ESTANDAR.length`), **preexistente**:
  falla igual con este diff en `git stash`.
- Runtime, navegador serial: consola sin errores ni advertencias; 375 px sin
  scroll horizontal (`scrollWidth === clientWidth === 360`); modo oscuro correcto.

## Fotos

| | |
|---|---|
| `01-antes-1440.png` | la pantalla como estaba |
| `02-antes-estudios-1440.png` | catálogo de estudios antes |
| `03-referencia-mis-servicios-1440.png` | la referencia |
| `04-despues-estudios-1440.png` | catálogo después |
| `05-despues-ficha-1440.png` · `06-despues-ficha-completa-1440.png` | la ficha con su tarjeta |
| `07-despues-375.png` · `08-despues-tarjeta-375.png` | 375 px |
| `09-despues-oscuro-1440.png` | modo oscuro |

## Lo que NO se tocó, y por qué

`features/admin/medical-organization` tiene el mismo bloque de cobertura abierto
al pie. Acá se plegó sólo el del laboratorio, que es lo que se pidió; si se
quiere la misma disciplina en la consola de organización, es un cambio aparte de
una línea y conviene hacerlo de una para que las dos no se separen.
