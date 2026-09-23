# Medición local — Directorio, reserva y Cotizaciones

Fecha: 2026-09-23. Entorno: servidor de desarrollo local y maqueta integrada;
paciente sintético `paciente@alovida.mock`.

Esto es una medición de una ejecución local, no un SLO ni una comparación con
producción. El baseline histórico no llegó a autenticar, por lo que no se
declara un «antes/después» inventado.

| Recorrido | Muestra | Resultado |
|---|---:|---|
| Navegar desde la sesión cargada a Directorio | 1 | 81 ms hasta que el encabezado `Directorio de médicos` fue visible. |
| Navegar desde Directorio a Cotizaciones | 1 | 66 ms hasta que el encabezado `Cotizaciones` fue visible. |
| Cuatro activaciones síncronas de una tarjeta de profesional | 4 | 294 ms hasta la ficha; `history.pushState` fue llamado **1** vez. |

La última activación cargó los módulos lazy de la ficha (`/@ng/component` y
chunks de Vite); no generó solicitudes de negocio adicionales en la maqueta.
No se crea una reserva ni se toca un turno: la prueba verifica exactamente el
contrato de navegación única de la tarjeta.

Comandos y salida literal:

```text
npx playwright test playwright/cierre-local-reserva-cotizaciones.spec.ts --grep "mide las rutas" --workers=1 --reporter=list
{"directorioMs":81,"cotizacionesMs":66}

npx playwright test playwright/cierre-local-reserva-cotizaciones.spec.ts --grep "cuatro activaciones" --workers=1 --reporter=list
{"activaciones":4,"ms":294,"pushState":1,"url":"/directory/0763dc7b-0b36-4cb5-a04e-af9ac60aa480"}
```
