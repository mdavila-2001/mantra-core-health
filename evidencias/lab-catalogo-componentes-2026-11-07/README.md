# Laboratorio · «Agregar del catálogo»: componentes tildables y «Elegir todos»

Corrida del 07/11/2026 contra `yarn start:demo` (simulador), Chromium sin cabeza.

| Qué | Resultado |
|---|---|
| Cada componente de un análisis tiene su casilla, tildada por defecto; el resumen dice «Sus componentes: 5 de 6 elegidos» | `lab-componentes-desktop.png`, `-tablet.png`, `-movil.png` |
| Tema oscuro (interruptor de la app, `data-theme="dark"`) | `lab-componentes-oscuro.png` |
| «Elegir todos» sin filtro tilda los 6 análisis aún no agregados y aparece «Quitar la elección» | `lab-elegir-todos-desktop.png` |
| Spec `playwright/lab-catalogo-precios.spec.ts`: destilda Hematocrito, agrega, recarga y en Precios no existe `HEMOGRAMA.HTO` | 1 pasó |
| Consola y red en los tres viewports | Sin errores |

## Lo que no se probó acá

- La ficha que ve el médico en el simulador (`/laboratory-directory/:id`) sale de datos de prueba y no
  está conectada a los Precios del laboratorio: no sirve para ver los tildes. Esa lectura se probó
  contra la API real (`GET /diagnostic-units/:id` lista sólo los componentes tildados).
- Contra la API real el front no se corrió: el entorno de la sesión no tiene el front apuntando a ella.
