# Portal de reportería

Portal de reportes de Alovida: un grid de reportes y un dashboard comercial con siete pestañas
(resumen, suscripciones de doctores, publicidad push y pauteo, comisiones y actores, cobros,
adquisición y calidad del dato). Hoy corre sobre la capa de simulación con **datos de EJEMPLO**
declarados en pantalla; la API real es la autoridad cuando exista.

Plan y evidencia del trabajo: `docs/trabajo/2026-10-30-reporteria-comercial-alovida/`.
Librería de gráficos: [ADR-0017](../adr/ADR-0017-echarts-chart-library.md).

## Estado compartido

| Pieza | Qué guarda | Qué pasa al cerrar sesión |
|---|---|---|
| `ReportContextStore` | Periodo, comparación, moneda, alcance y filtros por clic: lo que vale para todas las pestañas. Es el único dueño de los filtros. | `restablecer()` lo devuelve a los valores de fábrica; la persona siguiente no hereda nada. |
| `ReportPrefsStore` | Favoritos (persistidos por usuario) y reportes abiertos hace poco. | `reset()` vacía la memoria; los favoritos vuelven al entrar de nuevo. |
| `ReportAssistantData` | Los datos que el asistente trajo para contestar, con caché corta. | `limpiar()` los descarta. |
| `ChartThemeService` | Los colores del tema vigente, leídos de los tokens. | No guarda datos de personas. |

El historial de preguntas del asistente vive en `sessionStorage`, por usuario, y se borra al cerrar
sesión. La limpieza corre desde `session-cleanup.lazy.ts`, también cuando la sesión se cierra en otra
pestaña.

## Reglas que el código hace cumplir

- **Cada gráfico** trae título, gráfico, leyenda, tooltip, filtro por clic (si corresponde), «cómo se
  calcula» y velas (si corresponde). Si omite alguno trae el motivo escrito, y se ve en pantalla.
- **`null` no es cero**: un dato ausente sale como «Sin dato».
- **Alcance**: «Plataforma» solo se ofrece a `SUPERADMIN` y `PLATFORM_ADMIN`; el resto ve «Mi organización».
  Esto decide lo que se ofrece, no lo que se autoriza: la API valida el rol en cada petición.
- **El asistente no contesta sobre personas**: pacientes y datos clínicos se rechazan con alternativas.
- **Trato de «usted»** en todo el texto, vigilado por `reporting-usted.spec.ts` (datos y plantillas).
