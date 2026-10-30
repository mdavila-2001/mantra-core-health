import type {
  ContextoReporte,
  PestanaReporte,
  ReporteCatalogo,
  VerticalReporte,
} from '../../data-access/reporting/reporting.types';
import { forbidden, notFound, reply, validation, type MockRouter } from '../mock-router';
import { construirAdquisicion } from './reporting/adquisicion.dataset';
import { construirCalidad } from './reporting/calidad.dataset';
import { construirCobros } from './reporting/cobros.dataset';
import { construirComisiones } from './reporting/comisiones.dataset';
import { construirPublicidad } from './reporting/publicidad.dataset';
import { construirResumen } from './reporting/resumen.dataset';
import { construirSuscripciones } from './reporting/suscripciones.dataset';

/* ============================================================================
    Portal de reportería — servidor SIMULADO (maqueta).

    Datos de EJEMPLO. El catálogo mezcla las pestañas nuevas con pantallas que
    ya existen y leen la API real (vista contable, analítica de seguros): el
    grid es el punto de entrada único a todo lo que se puede reportar.
    ========================================================================== */

const CONSTRUCTORES: Readonly<Record<VerticalReporte, (ctx: ContextoReporte) => PestanaReporte>> = {
  resumen: construirResumen,
  suscripciones: construirSuscripciones,
  publicidad: construirPublicidad,
  comisiones: construirComisiones,
  cobros: construirCobros,
  adquisicion: construirAdquisicion,
  calidad: construirCalidad,
};

const CATALOGO: readonly ReporteCatalogo[] = [
  { id: 'rep-comercial', nombre: 'Dashboard comercial', vertical: 'resumen', descripcion: 'Ventas de las tres verticales: suscripciones de doctores, publicidad push y comisiones a actores, con pestañas y comparativos.', responsable: 'Dirección comercial', certificado: true, frescuraMin: 12, ruta: '/reports/commercial/resumen' },
  { id: 'rep-suscripciones', nombre: 'Suscripciones de doctores', vertical: 'suscripciones', descripcion: 'MRR, churn, cohortes de retención, conversión de prueba a pago y uso contra cuota.', responsable: 'Dirección comercial', certificado: true, frescuraMin: 12, ruta: '/reports/commercial/suscripciones' },
  { id: 'rep-publicidad', nombre: 'Publicidad push y pauteo', vertical: 'publicidad', descripcion: 'Campañas, conjuntos y anuncios con las métricas de un gestor de anuncios: alcance, frecuencia, CPM, CTR, CPA y ROAS.', responsable: 'Marketing', certificado: false, frescuraMin: 35, ruta: '/reports/commercial/publicidad', enDiseno: true },
  { id: 'rep-comisiones', nombre: 'Comisiones y actores', vertical: 'comisiones', descripcion: 'Comisión devengada, liquidada y pendiente por actor; take rate, payouts y aging.', responsable: 'Finanzas', certificado: true, frescuraMin: 60, ruta: '/reports/commercial/comisiones' },
  { id: 'rep-cobros', nombre: 'Cobros y caja', vertical: 'cobros', descripcion: 'Éxito de pago, reembolsos, disputas, rezago de liquidación y costo del gateway.', responsable: 'Finanzas', certificado: true, frescuraMin: 20, ruta: '/reports/commercial/cobros' },
  { id: 'rep-adquisicion', nombre: 'Adquisición y cuentas', vertical: 'adquisicion', descripcion: 'Embudo lead → activación, rendimiento por canal, cupones y salud de cuenta.', responsable: 'Crecimiento', certificado: false, frescuraMin: 180, ruta: '/reports/commercial/adquisicion' },
  { id: 'rep-calidad', nombre: 'Calidad del dato y definiciones', vertical: 'calidad', descripcion: 'Catálogo de KPI con fórmula, dueño, fuente y frescura; reglas de calidad.', responsable: 'Gobierno de datos', certificado: true, frescuraMin: 5, ruta: '/reports/commercial/calidad' },
  { id: 'rep-contable', nombre: 'Vista contable', vertical: 'existentes', descripcion: 'Resultado del periodo, documentos pendientes y cartera de la práctica. Pantalla existente conectada a la API.', responsable: 'Finanzas', certificado: true, frescuraMin: 30, ruta: '/administration/accounting/cockpit' },
  { id: 'rep-seguros', nombre: 'Analítica de seguros', vertical: 'existentes', descripcion: 'Reclamos, corredores y campañas de aseguradoras. Pantalla existente conectada a la API.', responsable: 'Seguros', certificado: false, frescuraMin: 90, ruta: '/administration/insurance-analytics' },
];

const PESTANAS = new Set<string>(Object.keys(CONSTRUCTORES));

/**
 * Para poder VER los estados que de otro modo no se ven (vacío, error, sin
 * permiso, atrasado) sin romper nada: un valor en `localStorage` —solo existe
 * en la rama de maqueta— fuerza la respuesta. Sin la llave, todo es normal.
 * Lo usan las capturas (`playwright/reporteria-capturas.spec.ts`).
 */
export const FORCED_STATE_KEY = 'mock:reporting:estado';
type ForcedState = 'error' | 'vacio' | 'sin-permiso' | 'atrasado' | null;

function forcedState(): ForcedState {
  try {
    const v = globalThis.localStorage?.getItem(FORCED_STATE_KEY);
    return v === 'error' || v === 'vacio' || v === 'sin-permiso' || v === 'atrasado' ? v : null;
  } catch {
    return null;
  }
}

function forcedResponse(state: ForcedState) {
  if (state === 'error') {
    return reply(500, { statusCode: 500, code: 'INTERNAL', message: 'Falla simulada del servidor de reportes', error: 'Internal Server Error' });
  }
  if (state === 'sin-permiso') {
    return forbidden('Su rol no puede ver este reporte.');
  }
  return null;
}

export function registrarReporteria(router: MockRouter): void {
  router.get('/reporting/catalog', () => {
    const state = forcedState();
    return forcedResponse(state) ?? (state === 'vacio' ? [] : CATALOGO);
  });
  router.post('/reporting/commercial/:pestana', (req) => {
    const pestana = req.params['pestana'] ?? '';
    if (!PESTANAS.has(pestana)) {
      return notFound('La pestaña pedida no existe.');
    }
    const ctx = req.body as ContextoReporte | null;
    if (ctx === null || typeof ctx !== 'object' || !('periodo' in ctx)) {
      return validation('El contexto de consulta es obligatorio.', [
        { field: 'periodo', message: 'es obligatorio' },
      ]);
    }
    const state = forcedState();
    const forzada = forcedResponse(state);
    if (forzada !== null) {
      return forzada;
    }
    const datos = CONSTRUCTORES[pestana as VerticalReporte](ctx);
    if (state === 'vacio') {
      return { ...datos, kpis: [], graficos: [], tablas: [], secciones: undefined };
    }
    if (state === 'atrasado') {
      return { ...datos, generadoEn: '2026-10-27T09:00:00-04:00', avisos: [...(datos.avisos ?? []), 'Los datos tienen más de 3 días.'] };
    }
    return datos;
  });
}
