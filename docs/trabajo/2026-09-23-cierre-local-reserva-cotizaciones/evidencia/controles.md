# Inventario de controles — Cotizaciones

Alcance: controles declarados por
`src/app/features/account/cotizaciones/cotizaciones.html`; no se atribuyen al
carril los controles compartidos del encabezado o del armazón.

| Control | Nombre visible | Acceso por teclado | Observación |
|---|---|---|---|
| `input` de búsqueda | `Buscar` | Tab, escritura y borrado | Etiquetado por su `label`; `data-testid=cotizaciones-busqueda`. |
| `select` de vertical | `Vertical` | Tab, flechas y Enter | Cinco opciones: Todas, Medicamentos, Análisis, Imagenología y Servicios médicos. |
| `select` de orden | `Ordenar por` | Tab, flechas y Enter | Precio y Cercanía. |

Resultado de la auditoría estática:

```text
rg -n -i 'iconOnly|icono|app-nav-icon|<button' cotizaciones.{html,ts,css}
# sin coincidencias

rg -n '<input|<select|<button' cotizaciones.html
# 1 input, 2 select, 0 button
```

No hay acciones propias de sólo ícono ni botones sin texto que requieran
globo/`aria-label`. El recorrido Playwright de teclado verifica búsqueda,
vertical y orden en navegador.
