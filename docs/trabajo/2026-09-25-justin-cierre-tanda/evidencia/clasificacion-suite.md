# La suite completa, corrida y clasificada (regla 80.4)

`corepack yarn test --watch=false` sobre `origin/mockup` @ `9b8bc46e`:

```text
 Test Files  8 failed | 596 passed (605)
      Tests  53 failed | 7896 passed (7950)
   Duration  156.66s
EXIT=1
```

Salida literal completa en [`suite-completa.txt`](./suite-completa.txt).

Esto es lo que las tres microtareas de regresión de la tanda (Carril A `H6.S1.M1`, Carril B
`H5.S1.M5`, C8 `C8.H2.M1`) existían para averiguar, y nadie había corrido. **La suite está en rojo.**

## Veredicto

**Ninguno de los 53 fallos es atribuible a los carriles de Justin.** Cada uno está clasificado abajo
con el corte en el que aparece, no por lectura del código.

| Archivo | Fallos | Causa localizada | Clase |
|---|---|---|---|
| `organization/pharmacy-inbox/inbox-order/inbox-order.spec.ts` | 23 | PR **#671** (`pablo/farmacia-carrito-y-navegacion`, Ola 0) | `EXTERNAL` |
| `organization/pharmacy-inbox/pharmacy-inbox.spec.ts` | 15 | PR **#671** (ídem) | `EXTERNAL` |
| `dashboard/patient-home/patient-home.spec.ts` | 10 | PR **#670** (`feature/sintomas-silueta-y-sexo`) | `EXTERNAL` |
| `dashboard/access-tree/access-tree.spec.ts` | 1 | commit **`8c7d7721`** — «Evoluciones» → «Notas médicas» (C7, PR #682) | `EXTERNAL` |
| `shell-layout/shell-layout.spec.ts` | 1 | **ya falla en el corte base `bf2c3545`** | `PREEXISTING` |
| `account/pharmacy-orders/checkout/checkout.spec.ts` | 1 | **pasa aislado**; sólo cae en la suite entera | `POLLUTION` |
| `clinical-record/patient-chart/measurement-grid/measurement-grid.spec.ts` | 1 | **pasa aislado** | `POLLUTION` |
| `shared/components/organisms/paginated-form/paginated-form.spec.ts` | 1 | **pasa aislado** | `POLLUTION` |

## Cómo se localizó cada causa (bisección, no lectura)

Se corrió **el mismo subconjunto** de specs en cada corte, para comparar igual contra igual:

```text
corte                                          resultado del subconjunto
bf2c3545  (#660, base de la noche)             103 passed (8 files)          ← verde
746142c6  (#662, itzan perfil-medico)          103 passed (8 files)          ← verde
8262b798  (#669, justin agenda-hoy)            103 passed (8 files)          ← verde
836e0f34  (#670, feature/sintomas-silueta)      10 failed | 93 passed        ← rompe patient-home
ed6fa8cf  (#671, pablo Ola 0 farmacia)          48 failed | 55 passed        ← suma pharmacy-inbox + inbox-order
6c0dac2e  (#677, antes de C5)                   48 failed | 55 passed
origin/mockup (#685)                            48 failed | 55 passed
```

**Los dos saltos caen en #670 y #671, los dos antes del primer PR de Justin de la noche (#673).**
Entre #669 y #673 no hay ningún commit de los carriles de esta tanda.

`access-tree` se localizó con `git log -S "Evoluciones" bf2c3545..origin/mockup -- src/app`, que
devuelve `8c7d7721 refactor(nombres): «Evoluciones» pasa a «Notas médicas» en el menú`. El propio
`core/navigation/navigation.map.ts:419` lo rotula: «C7 (homogeneización de nombres, 2026-09-25)».
El renombre no actualizó `access-tree.spec.ts`, que sigue esperando el rótulo viejo.

`shell-layout` falla ya en `bf2c3545` con
`ShellLayout > los nombres de ícono del registro y los del nav no se separaron`.

Los tres `POLLUTION` pasan al correrlos solos sobre el mismo `origin/mockup`:

```text
$ corepack yarn test --watch=false --include=<checkout|measurement-grid|access-tree|shell-layout|paginated-form>
 Test Files  2 failed | 3 passed (5)
      Tests  2 failed | 164 passed (166)
```

De los cinco que en la suite entera daban un fallo cada uno, **sólo dos se reproducen aislados**
(`access-tree` y `shell-layout`). Los otros tres son contaminación entre archivos dentro del mismo
trabajador de vitest, no un defecto del componente.

## Lo que esto NO dice

- **No dice que los carriles de Justin estén libres de defectos.** Dice que ninguno de los 53 rojos
  de hoy los señala. Un defecto que ningún test cubre sigue siendo invisible acá.
- **No se arregló ninguno de los ocho archivos.** Son de otros carriles y de otras personas; la
  regla 00 §3.2 prohíbe tocarlos desde acá. Están reportados, con su causa y su corte.
- El error dominante de los 38 de `pharmacy-inbox`/`inbox-order` es
  `Cannot configure the test module when the test module has already been instantiated`, en el
  `beforeEach` de cada archivo. Es un fallo de arranque del `TestBed`, no de una aserción: los 38
  casos ni siquiera llegan a ejercitar la pantalla.
