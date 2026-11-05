> **AVANCE: 0 / 17 — 0,0 %.** Traspaso: solo descubrimiento y plan; no hay código de producto.

# Reporte — Muestra de laboratorio y región corporal en la orden de estudios

- Fecha: 2026-10-31 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/jolly-wozniak-l651q1` (desde `dev`)
- Peldaño de evidencia alcanzado: `DISCOVERED` (peldaño 1). Nada cambió en código.

## Completado
Ninguna.

## A medias
### Descubrimiento
- Qué anda: se localizaron las piezas reales (tabla `clinical.service_requests`, entidad/DTO de la API, `analysis-order-block`, `app-anatomy-viewer`, catálogo `specimen-type`); ver tabla de hechos F1–F10 en el plan.
- Qué no anda: no hay ningún cambio de esquema, API ni pantalla.
- Qué falta exactamente: resolver las 4 ambigüedades del plan y ejecutar H1 → H2 → H3 en orden.
- Dónde quedó: solo `docs/trabajo/2026-10-31-estudios-muestra-y-region-corporal/`. Sin código.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S1.M1 | TODO | Respuesta de producto/clínica a las ambigüedades 1–4 |
| H1.S1.M2–H1.S2.M3 | TODO | H1.S1.M1 (y repos `-model` y `-api`, con su propia rama/PR) |
| H2.* | TODO | H1 desplegado o un doble de la API declarado (regla 65) |
| H3 | TODO | H1 y H2 |

## Evidencia
Solo lectura de código. Sin comandos de verificación ejecutados.

## No cubierto
Todo lo que implique ejecución: no se corrió lint, typecheck, build, tests ni la app.

## Desvíos del plan
Ninguno.

## Riesgos residuales
Ver tabla de riesgos del plan.

## Decisiones y ambigüedades
Ver «Desconocidos / ambigüedades» del plan. Decisiones del usuario (31/10/2026): en la orden; imagenología con 3D, tipo de hueso, lateralidad y modalidad; alcance front + API + modelo.
