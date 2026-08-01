# ADR-0001: Angular 21 standalone con señales, sin NgModule

## Estado

**Aceptado** — documenta el estado observado.

## Contexto

El frontend del ecosistema REDESA necesita sostener 81 secciones con estados de
interfaz contractuales (el M34), renderizado en servidor y un sistema de diseño
propio.

## Fuerzas y restricciones

- El backend es NestJS: TypeScript en los dos lados reduce el coste de cambiar
  de contexto.
- El modelo exige SSR y nueve estados de interfaz obligatorios.
- El equipo es chico: menos ceremonia es menos superficie que mantener.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| Angular con NgModule | Más ceremonia, y Angular 21 lo trata como legado |
| Angular con RxJS para el estado de componente | Señales son más simples para lo que este proyecto hace |
| React / Vue | Ecosistema distinto al del backend; SSR requiere más montaje propio |

## Decisión

**Angular 21.2, todo standalone, estado con señales.**

- **Cero `NgModule`.** Los 61 componentes son standalone.
- **Cero `@Input()`/`@Output()` con decorador**: `input()`, `input.required()`,
  `output()` y `model()`.
- **`OnPush` en todos** salvo la raíz.
- **Un solo `effect`** en todo el proyecto (`ThemeService`, para escribir en el
  DOM). Todo lo demás es `computed`.

## Consecuencias positivas

- Con señales, `OnPush` no exige disciplina extra: la notificación es puntual.
- El estado deriva en vez de duplicarse. `SessionStore` tiene **dos señales de
  escritura y diez derivadas**.
- `input.required()` hace que una entrada obligatoria que falte no compile.
- `strictTemplates` + señales atrapa en compilación lo que antes fallaba en
  ejecución.

## Consecuencias negativas

- Angular 21 es reciente: menos ejemplos y menos respuestas en la comunidad.
- Las API nuevas (`linkedSignal`, `resource()`) no se usan, así que hay una
  segunda ola de migración pendiente si se adoptan.
- El modo PnP de Yarn convive mal con Vite, y las pruebas avisan de ello.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Un `effect` que escribe otra señal produce un ciclo | Hoy hay uno solo, y escribe en el DOM |
| Una entrada de señal asignada directamente en una prueba no notifica | Se usa `setInput` |
| Subir de versión mayor de Angular | La superficie externa es mínima: 10 paquetes |

## Evidencia

- 61 componentes con `standalone` implícito; **cero `NgModule`** en `src/`.
- Cero `@Input()`/`@Output()`; 100 % entradas de señal.
- `grep -c "effect(" src/app` → 3, todos con motivo documentado.
- `tsconfig.json`: `strict`, `strictTemplates`, `noImplicitReturns`,
  `noPropertyAccessFromIndexSignature`.

## Plan de revisión

Revisar cuando salga la próxima versión mayor de Angular, o si aparece un caso
que `computed` no cubra y empujen los `effect`.
