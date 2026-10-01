# Logo del consultorio — evidencia (2026-09-30)

Cuenta `medica@alovida.mock` contra el simulador de `mockup`.

| Archivo | Qué prueba |
|---|---|
| `ficha-datos-personales-{con-logo,logo-cuadrado,sin-logo}-1440.png` | El bloque «Logo del consultorio» de la ficha, en «Datos personales» (lectura) |
| `editor-datos-personales-{con-logo,logo-cuadrado,sin-logo}-1440.png` | El editor: el logo **se carga, cambia y quita SÓLO acá** (arriba de «Datos personales») |
| `ficha-facturacion-*-1440.png`, `-390.png` | «Facturación» lo muestra sólo como vista previa de lectura, en la misma caja 2:1; el recuadro no cambia de alto sin logo. En móvil el logo pasa arriba |
| `pdf-con-logo(-cuadrado).pdf` / `pdf-sin-logo.pdf` (+ `-p1.png`) | PDF real descargado desde Contabilidad en los tres estados |
| `matriz-de-logos-membrete.png` | Membrete con jsPDF real: sin logo, cuadrado, 3:1, 10:1, 1:3, 4×4 y dato roto. El título y el contenido no se mueven en ningún caso |

`playwright/logo-del-consultorio.spec.ts` genera las capturas y los PDF
(`E2E_BASE_URL=… yarn pw --workers=1 playwright/logo-del-consultorio.spec.ts`; el test también comprueba que el editor de «Facturación» NO ofrece el logo).

Límites honestos:
- Los PDF `pdf-*.pdf` se bajaron **antes** del último ajuste del membrete (la
  clase de documento se corre a la izquierda del logo descontando el espaciado
  de letras). Con el logo 3:1 sembrado no cambia nada visible; el caso que sí
  cambiaba —logo 10:1— está en `matriz-de-logos-membrete.png`, ya con el ajuste.
- El simulador pierde los bytes de un archivo subido al recargar (F5): el test
  navega dentro de la SPA.
- El desborde horizontal de 23 px de la página a 390 px viene de la cabecera y
  las pestañas y es previo (se ve igual en «Datos personales»).
