# Reporte — Mostrar en el video cómo se aprueba y se rechaza una solicitud

- **Fecha:** 2026-10-05
- **Plan:** [PLAN.md](./PLAN.md)
- **Rama:** `marcelo/video-aprobar-rechazar-mockup`, con PR a `mockup`
- **Peldaño de evidencia alcanzado:** **VERIFIED**. El video y las capturas salen de una corrida real contra el app de `mockup`, y tienen doble revisión.
- **Avance:** 5 de 6 microtareas HECHO y 1 A MEDIAS, el PR (83,3 %).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | El video aprueba una solicitud abierta: confirma «Aprobar y facturar» y queda emitida la factura | `node tools/video-aseguradora/grabar.mjs` | salida 0 · capturas `03-confirmar-aprobacion.png` y `04-solicitud-aprobada.png` (FAC-004230 vigente) |
| H1.S1.M2 | El video rechaza otra solicitud escribiendo el motivo | ídem | capturas `05-confirmar-rechazo.png` y `06-solicitud-rechazada.png` (motivo visible, sin factura) |
| H1.S1.M3 | Video regenerado | `ffprobe` | h264 · 1920×1080 · 128,72 s |
| H1.S2.M1 | Doble revisión | [evidencia/doble-revision.md](./evidencia/doble-revision.md) | ninguna pantalla RECHAZADA |
| H1.S3.M2 | Este reporte | — | en disco |

## A medias

### H1.S3.M1 — PR a `mockup`
- **Qué anda:** la rama está pusheada y el PR está abierto, no en draft.
- **Qué no anda:** cuando se escribió este reporte los checks no habían terminado.
- **Qué falta exactamente:** volver a correr `gh pr view` y `gh pr checks` después del último push.
- **Dónde quedó:** en el PR.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| ninguno | — | — |

## Evidencia

```
$ node tools/video-aseguradora/grabar.mjs
Marcas (s): mi-perfil=0.4 · mis-productos=9.3 · solicitudes-recibidas=42.25 · aprobar=47.11 · rechazar=73.31 · siniestralidad-por-persona=106.84 · directorio=115.88 · fin=126.33
Controles: sin «Andina», sin dominios .mock, sin errores de página ni rutas sin manejador.
exit=0

$ ffprobe …mp4
codec_name=h264  width=1920  height=1080  duration=128.720000

$ npx eslint tools/video-aseguradora
exit=0
```

## No cubierto

- «Aprobar parcialmente» aparece como opción pero no se ejecuta en el video.
- El error de motivo vacío al rechazar.
- No se volvió a correr la suite de tests: este trabajo no toca código del app, solo el script y la documentación.

## Desvíos del plan

- Se agregaron dos capturas de los diálogos de confirmación para revisarlos. Las capturas se numeran ahora con un contador propio; antes saltaban números.
- La primera corrida falló porque `ng serve` estaba recompilando tras el cambio de rama y aparecía `vite-error-overlay`. La segunda corrida salió bien.

## Riesgos residuales

- «Decidido por» muestra el nombre de la organización («Alianza Seguros») y no el de una persona, porque así firma el simulador con una cuenta de organización.
- El commit del reporte anterior (`a8970158`, la regresión completa) no entró con #966. Se suma en este PR.

## Decisiones y ambigüedades

- **`dev` y `test` no necesitan cambios:**
  - las dos ramas ya tienen el directorio, idéntico al de `mockup`, con sus specs de menú (#955 y #956);
  - las dos usan la API real (`mockBackend: false`), así que el handler simulado y el script del video no aplican ahí.
- **Se mostraron aprobar y rechazar, que es lo pedido.** La aprobación parcial queda visible como opción. Confirmar con el usuario si también quiere verla ejecutada.
