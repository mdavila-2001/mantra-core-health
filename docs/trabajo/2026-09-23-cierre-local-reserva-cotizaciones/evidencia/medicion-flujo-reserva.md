# Medición local — Directorio hasta disponibilidad

Fecha: 2026-09-23. Actor sintético: `paciente@alovida.mock`.

## Recorrido observado

1. Abrir `/directory`.
2. Elegir la primera especialidad.
3. Pulsar `Revisar disponibilidad` de la primera tarjeta.
4. Esperar `app-practitioner-availability` y su primer botón de cupo.

| Medida | Resultado |
|---|---:|
| Total hasta disponibilidad visible | 1.468 ms |
| Repeticiones de navegación de la acción | 1 (prueba unitaria: dos activaciones) |
| Solicitudes de negocio visibles en Red | 0: el mock las intercepta en memoria |
| Recursos visibles en Red | módulos de desarrollo listados en `medicion-flujo-reserva.json` |

El comando fue:

```text
E2E_BASE_URL=http://127.0.0.1:4200 npx playwright test playwright/cierre-local-reserva-cotizaciones.spec.ts --grep "mide el recorrido del directorio" --workers=1 --reporter=list
```

Salida relevante: `1 passed (15.6s)`. La pantalla con la acción visible está
en `capturas/directorio-accion-disponibilidad.png`; los datos sin resumir en
`medicion-flujo-reserva.json`.
