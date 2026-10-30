/* ============================================================================
    Publicidad push y pauteo — catálogo de EJEMPLO.

    El módulo AÚN NO ESTÁ CERRADO: se modela como un gestor de anuncios tipo
    Meta Ads Manager (campaña → conjunto de anuncios → anuncio). Los nombres de
    campañas, anunciantes y anuncios son inventados; ningún dato es de una
    persona ni de una organización real, y nada de esto es de pacientes.
    Nombres reales del módulo `ads` del API (campaigns, ad_sets, ads,
    insights_daily, ad_invoices, ad_policy_*) solo como referencia de fuente.
    ========================================================================== */

export type TipoAnunciante = 'Doctor' | 'Clínica' | 'Farmacia' | 'Laboratorio' | 'Aseguradora';

export interface Anunciante {
  readonly nombre: string;
  readonly tipo: TipoAnunciante;
}

export type Objetivo = 'Citas agendadas' | 'Clientes potenciales' | 'Alcance';

export type EstadoEntrega =
  | 'Activa'
  | 'En fase de aprendizaje'
  | 'Aprendizaje limitada'
  | 'En revisión'
  | 'Rechazada'
  | 'Pausada';

/** Orden fijo de lectura de los estados (el color sigue a la entidad, no al ranking). */
export const ESTADOS: readonly EstadoEntrega[] = [
  'Activa',
  'En fase de aprendizaje',
  'Aprendizaje limitada',
  'Pausada',
  'En revisión',
  'Rechazada',
];

/** Fracción del periodo en que la campaña estuvo entregando. En revisión y rechazada: nunca. */
export const DIAS_ENTREGA: Readonly<Record<EstadoEntrega, number>> = {
  Activa: 1,
  'En fase de aprendizaje': 0.85,
  'Aprendizaje limitada': 0.7,
  Pausada: 0.35,
  'En revisión': 0,
  Rechazada: 0,
};

export const ANUNCIANTES: readonly Anunciante[] = [
  { nombre: 'Clínica Altiplano Salud', tipo: 'Clínica' },
  { nombre: 'Farmacia Vida Plena', tipo: 'Farmacia' },
  { nombre: 'Seguros Cóndor Salud', tipo: 'Aseguradora' },
  { nombre: 'Consultorio Cardio Sur', tipo: 'Doctor' },
  { nombre: 'Laboratorio Andes Diagnóstica', tipo: 'Laboratorio' },
  { nombre: 'Clínica Valle Dental', tipo: 'Clínica' },
  { nombre: 'Consultorio Pediátrico Arcoíris', tipo: 'Doctor' },
  { nombre: 'Farmacia Mi Botica 24h', tipo: 'Farmacia' },
  { nombre: 'Laboratorio Genos Bolivia', tipo: 'Laboratorio' },
  { nombre: 'Aseguradora Illimani Vida', tipo: 'Aseguradora' },
];

export interface Campana {
  readonly nombre: string;
  /** Índice en `ANUNCIANTES`. */
  readonly anunciante: number;
  readonly objetivo: Objetivo;
  readonly estado: EstadoEntrega;
  /** Peso relativo en el gasto antes de aplicar los días de entrega. */
  readonly peso: number;
  /** Gastado ÷ presupuesto esperado a la fecha. `null` si no entregó. */
  readonly pacing: number | null;
  /** Sesgos respecto al promedio de la plataforma (1 = igual). */
  readonly sesgoCpm: number;
  readonly sesgoCtr: number;
  readonly sesgoLead: number;
  readonly sesgoCita: number;
  /** Valor de EJEMPLO de una cita agendada para el anunciante, en BOB. */
  readonly valorCitaBob: number;
}

export const CAMPANAS: readonly Campana[] = [
  { nombre: 'Chequeo cardiológico de octubre', anunciante: 3, objetivo: 'Citas agendadas', estado: 'Activa', peso: 0.11, pacing: 0.97, sesgoCpm: 1.1, sesgoCtr: 1.05, sesgoLead: 1.1, sesgoCita: 1.12, valorCitaBob: 150 },
  { nombre: 'Vacunación y bienestar familiar', anunciante: 1, objetivo: 'Alcance', estado: 'Activa', peso: 0.12, pacing: 1.08, sesgoCpm: 0.7, sesgoCtr: 0.8, sesgoLead: 1, sesgoCita: 1, valorCitaBob: 0 },
  { nombre: 'Pediatría: control del niño sano', anunciante: 6, objetivo: 'Citas agendadas', estado: 'En fase de aprendizaje', peso: 0.07, pacing: 0.88, sesgoCpm: 1.15, sesgoCtr: 0.92, sesgoLead: 0.9, sesgoCita: 0.85, valorCitaBob: 95 },
  { nombre: 'Laboratorio en casa', anunciante: 4, objetivo: 'Clientes potenciales', estado: 'Activa', peso: 0.1, pacing: 1.02, sesgoCpm: 1, sesgoCtr: 1.1, sesgoLead: 1.2, sesgoCita: 1, valorCitaBob: 0 },
  { nombre: 'Seguro de salud individual', anunciante: 2, objetivo: 'Clientes potenciales', estado: 'Activa', peso: 0.13, pacing: 1.12, sesgoCpm: 1.35, sesgoCtr: 0.85, sesgoLead: 0.75, sesgoCita: 1, valorCitaBob: 0 },
  { nombre: 'Sonrisa saludable', anunciante: 5, objetivo: 'Citas agendadas', estado: 'Aprendizaje limitada', peso: 0.08, pacing: 0.79, sesgoCpm: 1.2, sesgoCtr: 0.78, sesgoLead: 0.8, sesgoCita: 0.7, valorCitaBob: 120 },
  { nombre: 'Descuentos en medicamentos crónicos', anunciante: 7, objetivo: 'Clientes potenciales', estado: 'Activa', peso: 0.07, pacing: 0.95, sesgoCpm: 0.85, sesgoCtr: 1.2, sesgoLead: 1.3, sesgoCita: 1, valorCitaBob: 0 },
  { nombre: 'Chequeo ejecutivo', anunciante: 0, objetivo: 'Citas agendadas', estado: 'Activa', peso: 0.14, pacing: 1.01, sesgoCpm: 1.25, sesgoCtr: 0.95, sesgoLead: 1.05, sesgoCita: 1.2, valorCitaBob: 210 },
  { nombre: 'Perfil genético preventivo', anunciante: 8, objetivo: 'Clientes potenciales', estado: 'Pausada', peso: 0.05, pacing: 0.9, sesgoCpm: 1.1, sesgoCtr: 0.88, sesgoLead: 0.85, sesgoCita: 1, valorCitaBob: 0 },
  { nombre: 'Plan familiar Illimani', anunciante: 9, objetivo: 'Clientes potenciales', estado: 'En revisión', peso: 0.06, pacing: null, sesgoCpm: 1.3, sesgoCtr: 0.9, sesgoLead: 0.8, sesgoCita: 1, valorCitaBob: 0 },
  { nombre: 'Telemedicina desde casa', anunciante: 0, objetivo: 'Citas agendadas', estado: 'Rechazada', peso: 0.05, pacing: null, sesgoCpm: 1, sesgoCtr: 1, sesgoLead: 1, sesgoCita: 1, valorCitaBob: 90 },
  { nombre: 'Mes de la salud de la mujer', anunciante: 0, objetivo: 'Citas agendadas', estado: 'Activa', peso: 0.09, pacing: 0.99, sesgoCpm: 0.95, sesgoCtr: 1.15, sesgoLead: 1.15, sesgoCita: 1.05, valorCitaBob: 130 },
];

export interface Anuncio {
  readonly nombre: string;
  /** Índice en `CAMPANAS`. */
  readonly campana: number;
  readonly conjunto: string;
  readonly formato: 'Imagen' | 'Video corto' | 'Carrusel' | 'Texto en notificación';
  /** Parte del gasto de la campaña (los de una misma campaña suman 1). */
  readonly peso: number;
  /** Costo por resultado respecto al promedio de su campaña (1 = igual). */
  readonly sesgoCosto: number;
}

export const ANUNCIOS: readonly Anuncio[] = [
  { nombre: 'Tu corazón merece un chequeo', campana: 0, conjunto: 'Adultos 45–64 · La Paz', formato: 'Video corto', peso: 0.5, sesgoCosto: 0.85 },
  { nombre: 'Agenda tu cardiólogo hoy', campana: 0, conjunto: 'Adultos 45–64 · La Paz', formato: 'Texto en notificación', peso: 0.3, sesgoCosto: 1.05 },
  { nombre: 'Chequeo con electrocardiograma', campana: 0, conjunto: 'Adultos 35–54 · El Alto', formato: 'Imagen', peso: 0.2, sesgoCosto: 1.7 },
  { nombre: 'Protege a tu familia esta temporada', campana: 1, conjunto: 'Madres y padres · Santa Cruz', formato: 'Carrusel', peso: 0.6, sesgoCosto: 0.9 },
  { nombre: 'Vacunas disponibles sin filas', campana: 1, conjunto: 'Madres y padres · Cochabamba', formato: 'Texto en notificación', peso: 0.4, sesgoCosto: 1.15 },
  { nombre: 'Control del niño sano', campana: 2, conjunto: 'Madres 25–40 · Cochabamba', formato: 'Imagen', peso: 0.55, sesgoCosto: 0.9 },
  { nombre: 'Pediatra a un toque', campana: 2, conjunto: 'Madres 25–40 · Sucre', formato: 'Video corto', peso: 0.45, sesgoCosto: 1.12 },
  { nombre: 'Tus análisis sin salir de casa', campana: 3, conjunto: 'Adultos 30–60 · Santa Cruz', formato: 'Video corto', peso: 0.65, sesgoCosto: 0.88 },
  { nombre: 'Toma de muestra a domicilio', campana: 3, conjunto: 'Adultos 30–60 · La Paz', formato: 'Imagen', peso: 0.35, sesgoCosto: 1.3 },
  { nombre: 'Cotiza tu seguro en un minuto', campana: 4, conjunto: 'Profesionales 28–45 · Santa Cruz', formato: 'Carrusel', peso: 0.5, sesgoCosto: 0.95 },
  { nombre: 'Cobertura para toda la familia', campana: 4, conjunto: 'Profesionales 28–45 · La Paz', formato: 'Imagen', peso: 0.5, sesgoCosto: 1.05 },
  { nombre: 'Limpieza dental con cita hoy', campana: 5, conjunto: 'Adultos 20–45 · Tarija', formato: 'Imagen', peso: 0.6, sesgoCosto: 0.8 },
  { nombre: 'Blanqueamiento: antes de fin de año', campana: 5, conjunto: 'Adultos 20–45 · Cochabamba', formato: 'Video corto', peso: 0.4, sesgoCosto: 1.45 },
  { nombre: 'Tus medicinas de siempre, más baratas', campana: 6, conjunto: 'Mayores de 50 · La Paz', formato: 'Texto en notificación', peso: 0.7, sesgoCosto: 0.9 },
  { nombre: 'Entrega de receta a domicilio', campana: 6, conjunto: 'Mayores de 50 · Santa Cruz', formato: 'Imagen', peso: 0.3, sesgoCosto: 1.35 },
  { nombre: 'Prueba genética preventiva', campana: 8, conjunto: 'Adultos 30–55 · Santa Cruz', formato: 'Video corto', peso: 1, sesgoCosto: 1 },
  { nombre: 'Chequeo ejecutivo para tu equipo', campana: 7, conjunto: 'Gerentes 35–60 · Santa Cruz', formato: 'Carrusel', peso: 0.45, sesgoCosto: 0.92 },
  { nombre: 'Un día de salud en una mañana', campana: 7, conjunto: 'Gerentes 35–60 · La Paz', formato: 'Imagen', peso: 0.55, sesgoCosto: 1.08 },
  { nombre: 'Mamografía y consulta sin espera', campana: 11, conjunto: 'Mujeres 40–65 · La Paz', formato: 'Video corto', peso: 0.5, sesgoCosto: 0.9 },
  { nombre: 'Tu salud, tu mes', campana: 11, conjunto: 'Mujeres 25–45 · Cochabamba', formato: 'Texto en notificación', peso: 0.5, sesgoCosto: 1.1 },
];

export interface Ubicacion {
  readonly nombre: string;
  /** Parte del gasto de la plataforma. */
  readonly parte: number;
  readonly sesgoCpm: number;
  readonly sesgoCtr: number;
  readonly sesgoLead: number;
  /** Plazas vendidas ÷ disponibles (EJEMPLO). */
  readonly ocupacion: number;
}

export const UBICACIONES: readonly Ubicacion[] = [
  { nombre: 'Notificación push', parte: 0.46, sesgoCpm: 1.25, sesgoCtr: 1.35, sesgoLead: 1, ocupacion: 78 },
  { nombre: 'Banner en la app', parte: 0.34, sesgoCpm: 0.85, sesgoCtr: 0.7, sesgoLead: 0.85, ocupacion: 64 },
  { nombre: 'Listado destacado', parte: 0.2, sesgoCpm: 0.9, sesgoCtr: 1.05, sesgoLead: 1.3, ocupacion: 91 },
];

export interface Ciudad {
  readonly nombre: string;
  readonly parte: number;
}

export const CIUDADES: readonly Ciudad[] = [
  { nombre: 'La Paz', parte: 0.31 },
  { nombre: 'Santa Cruz', parte: 0.29 },
  { nombre: 'Cochabamba', parte: 0.2 },
  { nombre: 'Sucre', parte: 0.08 },
  { nombre: 'Tarija', parte: 0.07 },
  { nombre: 'Otras ciudades', parte: 0.05 },
];

export const DISPOSITIVOS: readonly { readonly nombre: string; readonly parte: number }[] = [
  { nombre: 'Android', parte: 0.68 },
  { nombre: 'iPhone', parte: 0.27 },
  { nombre: 'Navegador web', parte: 0.05 },
];

export const MOTIVOS_RECHAZO: readonly { readonly nombre: string; readonly parte: number }[] = [
  { nombre: 'Afirmaciones sin respaldo clínico', parte: 0.3 },
  { nombre: 'Medicamentos con receta', parte: 0.22 },
  { nombre: 'Imágenes de antes y después', parte: 0.18 },
  { nombre: 'Segmentación con datos de salud', parte: 0.16 },
  { nombre: 'Texto o enlace no válido', parte: 0.14 },
];

export const DIAS_SEMANA: readonly string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
