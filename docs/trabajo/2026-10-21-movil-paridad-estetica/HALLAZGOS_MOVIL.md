# Hallazgos — móvil 390 × 844, estado «antes»

Origen: `playwright/movil-captura.spec.ts` contra `ng serve` con el backend
simulado, Chromium, tema claro y oscuro. **217 pantallas medidas y capturadas**
(16 sin sesión, 56 paciente, 50 médica, 95 superadmin); 9 rutas con parámetro
quedan «sin enlace» (no se inventan ids). Capturas en `evidencia/01-antes/`
(WebP; los PNG originales no se versionan, ver `scripts/capturas-a-webp.py`).
Cada fila se confirmó **mirando la captura**, no solo por la cifra.

| Clase medida | Pantallas | Qué es en la captura |
|---|---:|---|
| `sin-marca` | 192 | Ninguna pantalla autenticada muestra el isotipo ALOVIDA: en móvil la barra lateral (donde vive la marca) es un cajón cerrado. Además 9 públicas sin logo |
| `objetivo-chico` | 142 | Las migas de pan miden 32 × 18 px («Panel») y se repiten 113 veces; es **un componente**, no 142 problemas |
| `texto-chico` | 46 | Textos < 12 px |
| `tabla-ancha` / `tabla-columnas` | 16 / 11 | Tablas con 4+ columnas «imprescindibles» aplastadas: nombres en 4–5 líneas, códigos partidos («PAC-/20000»), triángulo ▼ como única pista del detalle |
| ~~`pestanas-desbordan`~~ | ~~15~~ | **Falso positivo, retirado.** `app-tabs` ya trae flechas ‹ › (se ve en `paciente/my-account-claro.webp`); la medición no las excluía. No se corrige nada |
| `muy-larga` | 13 | Páginas de más de 4 500 px (`/administration/clinical-forms` 7 112 px; Evoluciones llega al tope de 12 000) |
| `cortado` | 3 | **Mensajería**: panel de 877 px dentro de 390 (lista y conversación lado a lado); `/administration/my-practice` tabla de 489 px |
| `desborde` | 1 | **Agenda** de la médica: barra de acciones del día de 530 px |
| `h1` | 4 | Error, 404 y portabilidad sin `<h1>` |

## Familias y orden de ataque (por pantallas afectadas × gravedad)

| # | Familia | Defecto visto | Arreglo previsto | Alcance |
|---|---|---|---|---|
| 1 | **F3 Tablas** | Columnas aplastadas, texto partido, última columna cortada (Evoluciones, Organizaciones, Pacientes) | Modo tarjeta bajo 780 px en `app-data-table`, con etiqueta en cada dato; mobile-first | ~35 pantallas |
| 2 | **F1 Armazón** | Cabecera de 7–8 controles sin logo; «Tutoriales» y «Ajustes» ocupan lugar fijo | Isotipo ALOVIDA en la cabecera < 780 px; Tutoriales y Ajustes pasan al menú de la cuenta en pantallas estrechas (siguen alcanzables) | 192 pantallas |
| 3 | **F2 Migas** | 32 × 18 px | Área táctil ≥ 24 px (44 px en móvil) sin cambiar el aspecto en escritorio | ~113 |
| 4 | **F12 Mensajería** | Panel de 877 px; mensajes cortados («Si prefe…») | Una sola columna en móvil: lista → conversación, con botón de volver | 2 pantallas |
| 5 | **F-pub Públicas y estados** | Error, 404, verificar/activar/reenviar/recuperar/restablecer sin logo, contenido pegado arriba con 1 100 px vacíos, anillo de foco grueso sobre el título, «Ir al inicio» de 22 px, sin `<h1>` | Logo + centrado vertical + `<h1>` + objetivo táctil | 9 |
| 6 | **F-agenda** | Barra de acciones del día cortada («Mover hora…») | Que ajuste a la línea / desplace con indicio | 1 |
| 7 | **F-mapa Mapa de calor** | «Cuándo se concentra tu mes» queda cortado a las 11:00 sin indicio (las pestañas NO: tienen flechas) | Sombra-indicio en el borde de desplazamiento | 1 |
| 8 | F8 Densidad | Páginas kilométricas | Se vuelve a medir tras F3 (las tablas son la causa de la mayoría) | 13 |

No se tocan (fuera de alcance o ya justificados en `docs/refactor-profesional/trabajo/HALLAZGOS.md`):
la insignia «Demo» y su botón «Datos de prueba» (indicador del backend simulado),
los avisos de CSP en consola (solo desarrollo, N-01), y las pruebas rojas
preexistentes.

## Lo que la medición no ve y se juzga a ojo

Jerarquía, ritmo, equilibrio y densidad. Los pares «antes / después» lado a lado
están en [`ANTES_DESPUES.html`](./ANTES_DESPUES.html).
