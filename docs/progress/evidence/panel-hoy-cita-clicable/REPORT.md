# Panel del médico: la cita «Ahora» lleva a iniciarla — evidencia

Pedido del propietario (25/09/2026): la tarjeta «Ahora / A continuación» de la
primera pantalla del médico tiene que ser clicable y llevar a la cita para
poder iniciarla.

## Qué cambió

- `dashboard/agenda-de-hoy`: la tarjeta y cada renglón del día son un enlace
  estirado (toda la superficie responde) a `/schedule?booking=<id>`.
- `agenda`: con `?booking=<id>` lee la cita por id y ofrece «Iniciar
  consulta» (confirmada, ya llegó) o «Continuar consulta» (en curso); al
  confirmar inicia y entra a `/medical-records/:id/consultation`. Otros
  estados muestran su detalle y por qué no se atiende.

## Evidencia (rama `mockup`, maqueta en memoria, build de producción + SSR)

| Control | Resultado |
|---|---|
| `playwright/panel-hoy-cita-clicable.mjs` (1280 oscuro + 390 claro, serial) | **8/8 PASS**, consola sin errores |
| Specs dirigidos (3 nuevos) + regresión `features/dashboard` y `features/agenda` | **21 archivos · 521 pruebas PASS** |
| `eslint` sobre lo tocado · `yarn typecheck` | exit 0 · exit 0 |

Capturas: `*-1-panel.png` (reposo), `*-1b-panel-hover.png`, `*-2-dialogo.png`,
`*-3-consulta.png`, `*-4-renglon-dialogo.png`.

No corrido: contra la API real (el stack Docker no se levanta sin permiso).
