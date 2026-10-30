import { ANY_ROLE, type AppSection } from './navigation.types';

/* ============================================================================
    AloVida Insights — plataforma de inteligencia de marketing.

    Una sola sección del registro: los ocho módulos son rutas hijas del marco
    (`features/insights/insights.routes.ts`, enlazadas en `RUTAS_ANIDADAS`), igual
    que el portal de inventario. Vive en su propio archivo porque
    `navigation.map.ts` está congelado por `scripts/check-max-lines.mjs`.

    Los roles son los de «Analítica web» (marketing y plataforma de datos). La
    guarda evita llegar a una pantalla vacía; la autoridad sobre los datos sigue
    siendo la API.
    ========================================================================== */

export const INSIGHTS_SECTIONS: readonly AppSection[] = [
  {
    path: 'administration/marketing-insights',
    // 30/10/2026 · Insights es el portal de marketing, en `/insights` (fuera del
    // armazón de administración). La dirección vieja redirige en `app.routes.ts`
    // (`SECCIONES_REDIRIGIDAS`); la sección sigue registrada para que esa
    // redirección resuelva y para los subgrupos del menú.
    fueraDelMenuPara: [ANY_ROLE],
    label: 'AloVida Insights',
    group: 'Administración',
    icon: 'chart',
    roles: ['MARKETING_MANAGER', 'PLATFORM_ADMIN', 'DATA_PLATFORM_ADMIN'],
    availability: 'disponible',
    summary: 'Campañas, embudo, uso de la app, redes, opinión pública, informes, observatorio de salud y alertas, con benchmarks y recomendaciones.',
    module: 'M28 telemetry',
  },
];
