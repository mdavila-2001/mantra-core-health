# Reporte — CORR-07 · Perfil médico en lectura

## Veredicto

**VERIFIED FUNCTIONAL ONLY — cierre integral pendiente.** El teléfono de contacto declarado en el alta ahora se muestra en cada sede que lo tenga; el enlace usa `tel:`. Se preservan las siete pestañas que ya existen en el perfil. La revisión visual del resultado y sus 12 capturas terminó sin errores de medición. No se afirma el DoD completo porque faltan la regresión global, route-health y la comprobación Fable.

## Cambio

- `officeContactPhone` queda asociado a «Dónde atiendo» en el mapa de campos del alta.
- `PracticeSite.contactPhone` se expone en el tipo de lectura y se mapea desde la sede.
- Cada teléfono visible se presenta como enlace telefónico accesible.
- El verificador de evidencia reconoce las acciones de las pestañas «Dónde atiendo» y «Credenciales», cierra el aviso de ayuda y reinicia el desplazamiento antes de capturar.
- Se actualizó la ficha obsoleta para conservar las siete pestañas que ya tiene el producto: Datos personales, Contacto, Facturación, Dónde atiendo, Trayectoria, Credenciales y Actividad. La decisión se registra en `docs/progress/DECISIONS.md`.

No se modificaron modelo, API, backend, `.env` ni `proxy.conf.json`. No se agregaron ni quitaron aserciones.

## Evidencia visual

La línea base fue de 8 celdas / 0 rojas. La matriz final cubre 12 estados de `/my-account`: las tres pestañas verificadas a 375, 768 y 1440 px en claro, más 1440 px en oscuro. Resultado: **12 celdas / 0 rojas**. Se abrieron y revisaron las capturas finales, incluida la variante oscura corregida de «Dónde atiendo».

- [Matriz antes](MATRIZ-visual-antes.md) · [Matriz después](MATRIZ-visual.md)
- Fotos antes: [directorio](fotos/antes/)
- Fotos después: [resumen](fotos/despues/practitioner-profile-overview-1440-claro.png) · [dónde atiendo](fotos/despues/practitioner-profile-practice-1440-claro.png) · [credenciales](fotos/despues/practitioner-profile-credentials-1440-claro.png)
- [Foto móvil de sedes y teléfonos](fotos/despues/practitioner-profile-practice-375-claro.png) · [Foto oscura de sedes y teléfonos](fotos/despues/practitioner-profile-practice-1440-oscuro.png)

## Comandos y resultados

- `scripts/corr-evidencia.sh 37 --antes` — PASS; 8 celdas, 0 rojas.
- `CORR_USUARIO=medica scripts/corr-evidencia.sh 37` — PASS; Playwright con `--workers=1`, 12 celdas, 0 rojas. La última corrida tardó 38.2 s.
- `corepack yarn typecheck` — PASS.
- `corepack yarn eslint playwright/corr-evidencia.spec.ts src/app/features/account/my-profile/pestanas-del-perfil-medico.ts src/app/features/account/my-profile/pestanas-del-perfil-medico.spec.ts src/app/features/account/my-profile/practitioner-profile/practitioner-profile.ts src/app/features/account/my-profile/practitioner-profile/practitioner-profile-view/practitioner-profile-view.types.ts src/app/features/account/my-profile/practitioner-profile/practitioner-profile-view/practice-sites-map/practice-sites-map.spec.ts` — PASS.
- `corepack yarn test --watch=false --include='src/app/features/account/my-profile/pestanas-del-perfil-medico.spec.ts' --include='src/app/features/account/my-profile/practitioner-profile/practitioner-profile.spec.ts' --include='src/app/features/account/my-profile/practitioner-profile/practitioner-profile-view/practice-sites-map/practice-sites-map.spec.ts'` — PASS; 3 archivos, 67 pruebas.
- `git diff --check` — PASS.

La primera ejecución del spec del mapa de pestañas detectó el campo `officeContactPhone` sin asignación. Se agregó el mapeo y la expectativa correspondiente; la repetición final de los tres specs pasó.

## Revisión del diff

**VEREDICTO: APROBADO** para este cambio, tras auto-revisión con el checklist `corr-revisor-codigo`.

1. Alcance: PASS; la ampliación de tipos, mapeo, spec, evidencia y decisión documentada corresponde al resultado de la ficha.
2. Sólo visual: PASS; sin archivos de API/modelo, `.env` ni proxy.
3. Criterio: PASS; el teléfono declarado se ve en la sede y el dato queda mapeado a la pestaña correcta.
4. Organismos: PASS; el perfil conserva la tarjeta y pestañas existentes; no se recreó su estructura a mano.
5. Regla §6: PASS; no se agregó CSS ni restricción de ancho propia.
6. Tokens: PASS; no se agregaron estilos ni colores literales.
7. Modo oscuro: PASS; se inspeccionó la captura oscura y se conservan contraste y selección de pestaña.
8. Tests: PASS; los specs agregan expectativas de comportamiento y no debilitan otras.
9. Convenciones: PASS; identificadores, test IDs y acciones nuevas están en inglés; la UI está en castellano.
10. Accesibilidad: PASS; el teléfono usa un enlace `tel:` con el número como nombre visible.
11. Rutas: PASS; no se agregó ninguna ruta de producto.
12. Comandos: PASS; typecheck, lint dirigido, specs y evidencia tienen resultados registrados arriba.

## Pendiente para el DoD integral

- No se ejecutaron `corepack yarn lint` global, la suite global, build ni `playwright/carril-19-route-health.spec.ts` en esta rama. Para evitar otra sesión pesada, se limitaron las corridas a typecheck, lint y specs dirigidos, más la evidencia con un worker. La suite global y route-health ya habían mostrado fallos ajenos en las sesiones de verificación de la base: deben volver a cotejarse con su conteo antes/después, sin ocultar rojos.
- `scripts/atlas/fable-proof-check.py` no existe en esta punta de `mockup`.
- El PR se abre con este estado parcial y las comprobaciones pendientes visibles; no se mergea.
