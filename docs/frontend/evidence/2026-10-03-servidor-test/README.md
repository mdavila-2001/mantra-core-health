# Verificación en el servidor de `test` — alta de organización y pedido sin delivery

Fecha: 2026-10-03 (hora local de la Mac que ejecutó las pruebas, UTC-4) · Servidor: `https://test.173.249.39.237.sslip.io`

## Conclusión

**Funciona en el servidor real.** El alta de aseguradora —el escenario que daba el 422 «El catálogo de documentos de afiliación no está disponible»— completa con **201** desde un navegador, muestra «Tu cuenta está lista» y «Ir a iniciar sesión» lleva al acceso. Los casos límite y de error responden lo esperado y ninguno produjo un 5xx. El front desplegado ya no ofrece envío a domicilio y trae los textos nuevos.

## Qué estaba desplegado (Coolify, solo lectura)

[`salidas/coolify-despliegues.txt`](./salidas/coolify-despliegues.txt):

| App | Commit | Estado | Qué trae |
|---|---|---|---|
| API de test | `5e245aec` (05:49 UTC) → `b8315d9c` (06:34 UTC) | `finished` | El seeder de los 4 catálogos de afiliación (`#537`) desde las 05:49 UTC |
| Front de test | `30e69936` (05:46 UTC) → `af1550f4` (06:34 UTC) | `finished` | `#869` (botón), `#870` (sin delivery), `#884` (build) y `#886` (textos) |
| Front de test | `fa68b1c8` (06:13 UTC) | **`failed`** | El build roto por `pdfMinimo` (arreglado en `#884`) |

Las pruebas de abajo corrieron a las 02:38 (una prueba) y a las 02:46 (las 10) hora local, es decir 06:38 y 06:46 UTC, **después** de terminar el despliegue de `af1550f4` (06:34:51 UTC): se ejercitó la versión nueva.

## Pruebas y su salida literal

| Qué se demuestra | Prueba | Salida |
|---|---|---|
| El alta responde 201 y llega a la pantalla de éxito; «Ir a iniciar sesión» funciona; límite y error responden lo esperado, sin 5xx | **10 pruebas de navegador reales** contra el servidor | [`salidas/e2e-servidor-test-completo.txt`](./salidas/e2e-servidor-test-completo.txt): **10 passed (1,9 min)** |
| La pantalla de éxito se ve bien en móvil y modo oscuro **en el servidor** | Capturas de esa corrida | [`capturas/`](./capturas) |
| El front desplegado no contiene el envío a domicilio y sí los textos nuevos | Descarga de **todos** los JS públicos (1 116 archivos, cierre recursivo de chunks, con las tildes escapadas decodificadas) | [`salidas/servidor-test-bundle-sin-delivery.txt`](./salidas/servidor-test-bundle-sin-delivery.txt): **PASS** en las 11 comprobaciones |
| El ayudante de las pruebas estaba desactualizado y la corrección lo arregla | Mismo spec (maqueta) sin y con la corrección | [`SIN`](./salidas/ayudante-gerencias-SIN-correccion.txt) (falla esperando `…general-manager-name`) · [`CON`](./salidas/ayudante-gerencias-CON-correccion.txt) (pasa) |

## Qué no se demuestra con este método (y por qué)

- **La captura «antes del arreglo» en el servidor no existe**: cuando se auditó, el seeder ya estaba desplegado. El «antes» (422 reproducido y 201 tras el seeder, con la misma API sin reiniciar) está medido en una base local en frío: `mantra-core-health-api`, `docs/trabajo/2026-10-03-catalogo-afiliacion/evidencia/h2-kill-test.txt` y `h2-alta-tras-arreglo.txt`.
- **El rótulo «Envío a domicilio» sigue en el bundle** (1 aparición) **a propósito**: es el mapa de estados que permite leer pedidos antiguos con modalidad DOMICILIO/TRABAJO. Contexto literal en el archivo del bundle.
- **No se recorrió en el servidor el checkout con un paciente** (haría falta una cuenta y un pedido); el recorrido del checkout se verificó en la maqueta y por el análisis del bundle desplegado.
- Sólo Chromium; sólo el alta de aseguradora (laboratorio y farmacia comparten el servicio de catálogos).

## Datos de prueba que esta verificación dejó en el servidor de `test`

Todos sintéticos, con razón social «Aseguradora de Prueba <código>» y correos `@alovida.test`; quedan **pendientes de aprobación** (no aparecen en búsquedas de pacientes). Un administrador puede borrarlos o dejarlos.

- Corrida completa (sufijo `MUS148A6`): organizaciones con código `OKMUS148A6`, `LGMUS148A6`, `VSMUS148A6`, `8A6` (el de 3 caracteres), `DUPMUS148A6` y `C1MUS148A6`; cada una con 6 PDF de prueba generados.
- Una corrida anterior de una sola prueba (`visual`, sufijo no registrado) creó una organización más con código `VS<sufijo>`.
- Intentos que no llegaron a enviarse (el primero falló antes del envío por un identificador desactualizado) dejaron archivos PDF de prueba sin organización asociada.
