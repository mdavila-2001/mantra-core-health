import type { DimensionFiltro, VerticalReporte } from './reporting.types';

export const ETIQUETA_DIMENSION: Readonly<Record<DimensionFiltro, string>> = {
  plan: 'plan',
  especialidad: 'especialidad',
  ciudad: 'ciudad',
  organizacion: 'organización',
  campana: 'campaña',
  anunciante: 'anunciante',
  actor: 'actor',
  canal: 'canal',
  'metodo-pago': 'método de pago',
  estado: 'estado',
  mes: 'mes',
};

export const ETIQUETA_VERTICAL: Readonly<Record<VerticalReporte, string>> = {
  resumen: 'Resumen ejecutivo',
  suscripciones: 'Suscripciones de doctores',
  publicidad: 'Publicidad push y pauteo',
  comisiones: 'Comisiones y actores',
  cobros: 'Cobros y caja',
  adquisicion: 'Adquisición y cuentas',
  calidad: 'Calidad del dato',
};

export const VERTICALES: readonly VerticalReporte[] = [
  'resumen',
  'suscripciones',
  'publicidad',
  'comisiones',
  'cobros',
  'adquisicion',
  'calidad',
];
