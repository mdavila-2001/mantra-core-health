# Capturas «antes» (H1.S2.M3 y H1.S2.M4)

Sesión: `medica@alovida.mock` (Dra. Valeria Rojas Mendoza), navegador Chromium vía Playwright MCP,
`http://localhost:4200`, corte `8ae7283a`.

| # | Archivo | Qué muestra |
|---|---|---|
| 1 | `01-donde-atiendo-editor-1440.png` | `/my-account/edit` → «Dónde atiendo», escritorio (1440). Lista de 4 sedes, sin barra, sin paginación |
| 2 | `02-donde-atiendo-ficha-1440.png` | `/my-account` → «Dónde atiendo», ficha, escritorio (1440). Mismo `app-work-history`, modo lectura |
| 3 | `03-retirar-confirma-1440.png` | Diálogo «Dejar de atender acá» abierto tras pulsar «Dejar de atender» en «Clínica Los Olivos» |
| 4 | `04-editar-formulario-en-linea-1440.png` | Tras «Acciones → Editar» sobre «Consultorio Dra. Rojas»: el formulario **aparece debajo de la lista**, no en un modal |
| 4b | `04b-formulario-inline-completo-1440.png` | El mismo formulario, página completa (`fullPage`), mostrando el mapa de departamentos debajo |
| 5 | `05-donde-atiendo-editor-375.png` | `/my-account/edit` → «Dónde atiendo», móvil (375) |
| 6 | `06-donde-atiendo-ficha-375.png` | `/my-account` → «Dónde atiendo», ficha, móvil (375) |

## Respuestas observadas (H1.S2.M3)

1. **¿«Retirar» desde `app-row-actions` confirma?** **Sí.** Botón «Dejar de atender» (fuera del
   menú, para las sedes que no son el consultorio propio) abre `app-content-dialog` con título
   «Dejar de atender acá», texto «¿Retirar «Clínica Los Olivos · Sede Central» de tus
   consultorios?…», botones Cancelar/Retirar. Se **canceló** la acción (no se mutó el simulador).
   Para el consultorio propio, la acción vive en el menú «Acciones» (Ver QR / Editar / Retirar) —
   mismo mecanismo, no se ejecutó «Retirar» sobre el propio para no perder el dato de partida.
2. **¿«Agregar mi consultorio propio» abre el formulario debajo de la lista?** La cuenta de
   prueba **ya tiene** un consultorio propio («Consultorio Dra. Rojas», es uno solo — no hay botón
   «Agregar mi consultorio propio» visible con este estado). Lo que sí se ejerció es **la misma
   pieza de formulario** vía «Acciones → Editar»: confirmado, el formulario «Corregir tu
   consultorio» se inyecta **dentro del `tabpanel`, debajo del `<ul>` de sedes** (ver snapshot de
   Playwright: `tabpanel > … > list > … > generic "Corregir tu consultorio" (formulario)`), no en
   un `app-content-dialog`. Esto **confirma textualmente** el defecto que el ADR-0015 y H4.S2 van a
   corregir (D-04). El caso "alta" (sin consultorio propio previo) queda por ejercitar con datos
   sintéticos nuevos en H4, porque mutar el único consultorio propio de la cuenta demo lo deja sin
   uno — se registra como no cubierto en el reporte.
3. **¿Cuántas de las 30 tablas tienen barra? ¿Cuántas paginación?** Ver `evidencia/antes/tablas.md`
   (H1.S2.M1): 4 de 30 con `app-filter-bar`, 0 con `app-pagination` externo.

## Consola y red (H1.S2.M4)

- Antes de loguearse (`/auth`), 2 errores de CSP (`script-src` bloqueando un script inline) — **no
  relacionados** con mis archivos, pre-existentes en la plantilla de auth.
- Después de loguearse y navegar por «Dónde atiendo» (ficha y editor, abrir/cancelar el diálogo de
  retiro, abrir/cancelar el formulario de edición): **0 errores, 0 warnings** nuevos.
- Red: sin peticiones 4xx/5xx observadas en la ventana de navegación capturada (mock backend
  responde 200 vía `mock-backend.interceptor.ts`, `mockBackend: true`).
