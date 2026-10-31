# Portal AloVida Insights

Portal de inteligencia de marketing de AloVida, de **alcance plataforma**: lo usa el equipo de
marketing de la plataforma, no cada organización. Vive en `/insights`, con su propio marco,
fuera del armazón de administración (igual que `/reports`). Hoy corre sobre la capa de
simulación con **datos de EJEMPLO** declarados en pantalla; la API real es la autoridad cuando
exista.

Plan y evidencia del trabajo: `docs/trabajo/2026-10-30-alovida-insights/` (primera versión, con
datos en el navegador) y `docs/trabajo/2026-10-30-alovida-insights-portal/` (portal propio,
contrato con la API y cierre de brechas frente al prototipo).

## Direcciones

| Dirección | Qué abre |
|---|---|
| `/insights` | Entra al Panel general (`/insights/home`). |
| `/insights/home` | 00 · Panel general: índice de reputación, indicadores de la semana, registros de 30 días con hitos, alertas principales, lectura automática y una ficha por módulo. |
| `/insights/campaigns` | 01 · Resumen de campañas |
| `/insights/funnel` | 02 · Embudo y experiencia del paciente |
| `/insights/app-usage` | 03 · Uso de la app |
| `/insights/social` | 04 · Redes sociales |
| `/insights/opinion` | 05 · Opinión pública |
| `/insights/reports` | 06 · Generador de informes |
| `/insights/observatory` | 07 · Observatorio de salud |
| `/insights/alerts` | 08 · Alertas de marketing |

La dirección anterior, `/administration/marketing-insights` (y `/administration/marketing-insights/:module`),
redirige a la nueva conservando el módulo y el query. Los favoritos viejos siguen funcionando.

## Quién entra

Los roles `SUPERADMIN`, `PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN` y `MARKETING_MANAGER`
(`ROLES_INSIGHTS`, en `features/reporting/reporting-access.ts`). **`BUSINESS_ADMIN` no entra**:
los datos son de marketing de la plataforma, no de una organización.

- Quien solo tiene Insights (un `MARKETING_MANAGER`) entra derecho a `/insights`, sin pantalla de paso.
- Quien tiene dos o más portales elige en `/portal-selector`.
- La ruta lleva `authGuard` y `seccionRolesGuard` con los roles escritos en su `data`. Ocultar una
  tarjeta no es seguridad: la autoridad es la API.

## Servicios

| Servicio | Qué hace |
|---|---|
| `InsightsContext` | Contexto de análisis (campaña, periodo, canal, métrica): viaja en la URL y se conserva al cambiar de módulo. |
| `InsightsData` | Carga el catálogo y los hechos de campañas desde la API (`InsightsClient`), los instala en el dominio y expone el estado de la vista (`ViewState`). El marco no pinta ninguna pantalla hasta que está listo. |
| `InsightsClient` | Cliente HTTP de `/marketing/insights/*`: catálogo y hechos diarios por campaña y canal. |

## Estado de los datos

Todo el dato es sintético y se declara en cada pantalla. No hay cifras de campañas ni de usuarios
reales de AloVida.
