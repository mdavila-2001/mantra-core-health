# REPORT — Carril 39 · CORR-09

## Veredicto: VERIFIED para la interfaz; regresión integral pendiente

El recorrido visual del editor de credenciales pasó con las ocho combinaciones de ruta, viewport y tema; la matriz final tiene 8 celdas aprobadas y ninguna roja. Abrí y revisé las ocho capturas. La variante con adjunto muestra el diálogo y una matrícula sintética generada en el navegador, marcada «sin validez legal». Sólo demuestra presentación visual. El código del editor sube adjuntos mediante `FilesClient` y asocia el `fileId`; los specs prueban ese flujo con HTTP simulado. La evidencia no afirma que el servidor API estuviera disponible durante la captura.

La ficha se actualizó el 2026-10-15 para reflejar el módulo compartido y el editor que ya existen en `mockup`. Se conserva la sección dentro de `practitioner-profile-edit`: extraer otro componente no cambia el resultado observable. D-22 documenta esta decisión y el uso de los endpoints existentes; este carril no modifica backend, contrato, modelo, DDL ni seeds.

## Causa corregida en la evidencia

La ruta base selecciona la pestaña Credenciales con `?pestana=5`. En la variante `with-file=1`, el control vive dentro del diálogo de alta; el test pulsa «Agregar matrícula», elige la muestra sintética y desplaza la vista previa al área visible antes de fotografiarla. El capturador también espera que el menú y el espacio del marco coincidan, fija la preferencia real de tema en `localStorage` y desactiva animaciones finitas al tomar la foto. Esto evita capturas con contenido bajo el menú, tema incorrecto o diálogo a medio abrir.

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

- `CORR_EVIDENCE_DESTINATION="$PWD/docs/progress/evidence/lane-39" scripts/corr-evidencia.sh 39` — PASS; 8 celdas, 0 rojas. Se usó el destino explícito para no sobrescribir informes del directorio padre.
- `corepack yarn typecheck` — PASS.
- `corepack yarn ng build` — PASS; Angular emitted existing CommonJS/prerender warnings.
- `corepack yarn ng test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts --include=src/app/shared/components/molecules/file-input/file-input.spec.ts` — revalidado en esta rama: 2 archivos, 215 pruebas aprobadas.
- En la validación anterior de la base `mockup`, `corepack yarn ng test --watch=false` aprobó 583 archivos / 7.375 pruebas; no se repitió globalmente en esta rama.
- `corepack yarn lint` — FAIL global preexistente: 246 errores `@angular-eslint/prefer-on-push-component-change-detection`; no se modificó ni silenció ninguno.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — bloqueado en `beforeAll`: la API requerida no está viva; 3 escenarios no corrieron.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 39` — no ejecutable: el archivo `scripts/atlas/fable-proof-check.py` no existe en la punta `mockup` revisada.

El comando `corepack yarn test --watch=false` invoca `scripts/generate-env.mjs`, que lee `.env`; se evitó tocar ese archivo y se ejecutó directamente `corepack yarn ng test --watch=false`, que corre la misma suite Angular/Vitest.

## Bugs encontrados / corregidos

- El guion buscaba el selector antes de abrir el diálogo de matrícula; ahora ejecuta el flujo real. También fija el tema persistido y espera el layout y las animaciones antes de medir y fotografiar.
- En el PR #611 no se modificó código de producto, contratos, servicios, API, modelo ni `.env`; ese PR corrigió la ruta de evidencia y agregó matrices/fotos/reporte. El editor que muestra las capturas ya estaba en la base `mockup`.

## Revisión de código

**VEREDICTO: APROBADO** para el diff de evidencia de este carril. Cambia el recorrido de Playwright para esperar el layout, usar el tema declarado y mostrar un adjunto sintético legible; no cambia producto, API ni contratos y no debilita aserciones. El destino de salida es configurable y conserva el destino histórico por omisión. La matriz y las capturas finales se registran arriba.

## Riesgos residuales

- El PNG sintético sólo prueba selección y presentación visual. Los specs comprueban por separado la secuencia de subida y asociación de `fileId` con respuestas HTTP simuladas.
- No se probó la disponibilidad del backend en vivo durante este carril; route-health sigue bloqueado por la API local ausente.
- Esta rama corrige el verificador y conserva evidencia actual. No produjo un nuevo “antes/después” del producto porque no cambió la interfaz.

## Decisiones

- Para las rutas actuales del editor, se usa el parámetro `pestana=5` documentado y cubierto por `practitioner-profile-edit.spec.ts`; las rutas antiguas con `tab=credentials&edit=1` de la ficha no corresponden al router actual.
- D-22: la ficha se actualizó con el flujo actual de adjuntos y se conservó la estructura del editor existente; no se agregó una extracción sin valor visible.
- No se copió ni alteró ningún flujo de Paciente.

## Revalidación documental y dirigida — 2026-10-15

- `corepack yarn typecheck` — PASS.
- `corepack yarn eslint playwright/corr-evidencia.spec.ts src/app/features/auth/registro-compartido/credenciales-del-medico.ts` — PASS.
- `corepack yarn ng test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts --include=src/app/shared/components/molecules/file-input/file-input.spec.ts` — PASS, 2 archivos / 215 pruebas.
- `git diff --check` — PASS después de la captura final.
- `CORR_EVIDENCE_DESTINATION="$PWD/docs/progress/evidence/lane-39" scripts/corr-evidencia.sh 39` — PASS; 8 celdas, 0 rojas. Se fijó el tema explícito de la app, se esperó la geometría estable y se inspeccionaron visualmente las ocho fotos.
- No se repitió la suite global para evitar una corrida intensiva; el conteo anterior se conserva como antecedente, no como revalidación de esta rama.

La prueba dirigida usa HTTP simulado y acredita la secuencia frontend. La API en vivo, la regresión global de la serie actual y Fable siguen fuera de lo verificado en esta revalidación; el DoD integral continúa pendiente.
