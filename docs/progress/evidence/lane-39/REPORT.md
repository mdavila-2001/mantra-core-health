# REPORT — Carril 39 · CORR-09

## Veredicto: VERIFIED (alcance visual de la ficha)

El recorrido visual del editor de credenciales pasó en la maqueta con las ocho combinaciones de ruta, viewport y tema. Se revisaron las ocho capturas; la vista con archivo muestra `matricula.png`, su peso y la acción para quitarlo. Este carril conserva el límite de su ficha: el archivo es local a la maqueta y no se declara subida ni persistencia en API.

## Causa corregida en la evidencia

La primera ejecución falló porque `playwright/corr-rutas.json` abría `/my-account/edit?with-file=1` en la pestaña inicial, “Datos personales”. El input `matricula-archivo` está en “Credenciales”, y la ruta del editor selecciona esa pestaña con `?pestana=5` (`PESTANA_EDITOR.credenciales`). Se corrigieron ambas rutas del carril para que el test llegue al contenido que la ficha pide.

## Rutas

| Ruta | 375 | 768 | 1440 | Oscuro | Fondo | Centrado | Ancho | Scroll H | Consola |
|---|---|---|---|---|---|---|---|---|---|
| `/my-account/edit?pestana=5` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| `/my-account/edit?pestana=5&with-file=1` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

La medición comprobó fondo blanco en tema claro, márgenes equilibrados, tarjeta con ancho ≥85 % del área, cero scroll horizontal y cero errores de consola. En oscuro se verificaron centrado, ancho, scroll y consola.

## Fotos

- [credenciales-edicion — 375 claro](fotos/despues/credenciales-edicion-375-claro.png)
- [credenciales-edicion — 768 claro](fotos/despues/credenciales-edicion-768-claro.png)
- [credenciales-edicion — 1440 claro](fotos/despues/credenciales-edicion-1440-claro.png)
- [credenciales-edicion — 1440 oscuro](fotos/despues/credenciales-edicion-1440-oscuro.png)
- [credenciales-con-adjunto — 375 claro](fotos/despues/credenciales-con-adjunto-375-claro.png)
- [credenciales-con-adjunto — 768 claro](fotos/despues/credenciales-con-adjunto-768-claro.png)
- [credenciales-con-adjunto — 1440 claro](fotos/despues/credenciales-con-adjunto-1440-claro.png)
- [credenciales-con-adjunto — 1440 oscuro](fotos/despues/credenciales-con-adjunto-1440-oscuro.png)

## Comandos y salida

- `E2E_BASE_URL=http://127.0.0.1:4200 CORR_USUARIO=medica scripts/corr-evidencia.sh 39` — PASS; 8 celdas, 0 rojas.
- `corepack yarn typecheck` — PASS.
- `corepack yarn ng build` — PASS; Angular emitted existing CommonJS/prerender warnings.
- `corepack yarn ng test --watch=false --include='src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts' --include='src/app/shared/components/molecules/file-input/file-input.spec.ts'` — 2 archivos, 95 pruebas aprobadas.
- `corepack yarn ng test --watch=false` — 583 archivos, 7.375 pruebas aprobadas.
- `corepack yarn lint` — FAIL global preexistente: 246 errores `@angular-eslint/prefer-on-push-component-change-detection`; no se modificó ni silenció ninguno.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — bloqueado en `beforeAll`: la API requerida no está viva; 3 escenarios no corrieron.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 39` — no ejecutable: el archivo `scripts/atlas/fable-proof-check.py` no existe en la punta `mockup` revisada.

El comando `corepack yarn test --watch=false` invoca `scripts/generate-env.mjs`, que lee `.env`; se evitó tocar ese archivo y se ejecutó directamente `corepack yarn ng test --watch=false`, que corre la misma suite Angular/Vitest.

## Bugs encontrados / corregidos

- El test no abría la pestaña “Credenciales” y fallaba antes de adjuntar el archivo. Las rutas ahora incluyen `pestana=5`; el recorrido con archivo volvió a pasar.
- No se modificó código de producto, contratos, servicios, API, modelo ni `.env`.

## Revisión de código

**VEREDICTO: APROBADO** para el diff del carril. Solo cambia las dos rutas de evidencia de CORR-39 y agrega su matriz, fotos y reporte. No hay ruta nueva, CSS, cambios funcionales, edición de specs ni debilitamiento de aserciones. El comando de typecheck y las salidas de lint/spec/build están registrados arriba.

## Riesgos residuales

- La captura y la vista previa usan un PNG sintético de 70 bytes; solo prueban la selección y presentación local del archivo en la maqueta.
- La revisión no acredita carga, descarga ni persistencia real de adjuntos, que la ficha deja fuera de este carril.
- Esta rama corrige la ruta del verificador y conserva evidencia actual. No produjo un nuevo “antes/después” del producto porque no cambió la interfaz.

## Decisiones

- Para las rutas actuales del editor, se usa el parámetro `pestana=5` documentado y cubierto por `practitioner-profile-edit.spec.ts`; las rutas antiguas con `tab=credentials&edit=1` de la ficha no corresponden al router actual.
- Se conservaron el alcance y los adjuntos locales descritos por la ficha. No se copió ni alteró ningún flujo de Paciente.
