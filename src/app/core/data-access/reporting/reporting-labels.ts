import type { CategoriaReporte, DimensionFiltro, VerticalReporte } from './reporting.types';

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
  endpoint: 'operación',
  pantalla: 'pantalla',
  funcionalidad: 'funcionalidad',
  dominio: 'dominio',
  codigo: 'código',
  metodo: 'método',
  modulo: 'módulo',
  hora: 'hora',
};

export const ETIQUETA_VERTICAL: Readonly<Record<CategoriaReporte, string>> = {
  resumen: 'Resumen ejecutivo',
  suscripciones: 'Suscripciones de doctores',
  publicidad: 'Publicidad push y pauteo',
  comisiones: 'Comisiones y actores',
  cobros: 'Cobros y caja',
  adquisicion: 'Adquisición y cuentas',
  calidad: 'Calidad del dato',
  existentes: 'Pantallas existentes',
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
