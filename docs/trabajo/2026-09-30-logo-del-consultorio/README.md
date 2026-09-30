# Logo del consultorio — evidencia (2026-09-30)

Cuenta `medica@alovida.mock` contra el simulador de `mockup`.

| Archivo | Qué prueba |
|---|---|
| `ficha-facturacion-con-logo-1440.png` | Logo sembrado dentro del recuadro de Facturación, en su caja 2:1 |
| `ficha-facturacion-logo-cuadrado-1440.png` | Tras subir un PNG cuadrado desde el editor y guardar |
| `ficha-facturacion-sin-logo-1440.png` | Tras «Quitar logo»: «Sin logo» en la misma caja, el recuadro no cambia de alto |
| `ficha-facturacion-sin-logo-390.png` | Móvil: el logo pasa arriba de los datos |
| `editor-facturacion-*-1440.png` | El editor muestra la misma caja, con logo, con uno nuevo y sin logo |
| `pdf-con-logo(-cuadrado).pdf` / `pdf-sin-logo.pdf` (+ `-p1.png`) | PDF real descargado desde Contabilidad en los tres estados |
| `matriz-de-logos-membrete.png` | Membrete con jsPDF real: sin logo, cuadrado, 3:1, 10:1, 1:3, 4×4 y dato roto. El título y el contenido no se mueven en ningún caso |

`playwright/logo-del-consultorio.spec.ts` genera las capturas y los PDF
(`E2E_BASE_URL=… yarn pw playwright/logo-del-consultorio.spec.ts`).

Límites honestos:
- Los PDF `pdf-*.pdf` se bajaron **antes** del último ajuste del membrete (la
  clase de documento se corre a la izquierda del logo descontando el espaciado
  de letras). Con el logo 3:1 sembrado no cambia nada visible; el caso que sí
  cambiaba —logo 10:1— está en `matriz-de-logos-membrete.png`, ya con el ajuste.
- El simulador pierde los bytes de un archivo subido al recargar (F5): el test
  navega dentro de la SPA.
- El desborde horizontal de 23 px de la página a 390 px viene de la cabecera y
  las pestañas y es previo (se ve igual en «Datos personales»).
