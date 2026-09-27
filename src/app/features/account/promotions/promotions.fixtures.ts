/* ============================================================================
    Las promociones de la maqueta (rama `mockup`, sin API).

    Ningún backend publica todavía «las promociones que le llegaron a una
    persona» (B-REAL-13). En `mockup` la pantalla se muestra con estos datos
    para que el cliente la recorra con buscador y filtros como un directorio.
    Medicamentos de venta libre a propósito: el nombre no debe insinuar un
    diagnóstico.
    ========================================================================== */

export const UN_DIA = 24 * 60 * 60 * 1000;

export type EstadoDePromocion = 'nueva' | 'vista' | 'vencida';

export interface CategoriaDePromocion {
  readonly code: string;
  readonly label: string;
}

export interface Promocion {
  readonly id: string;
  readonly farmacia: string;
  readonly farmaciaVerificada: boolean;
  readonly ciudad: string;
  readonly titulo: string;
  readonly medicamento: string;
  readonly categoria: CategoriaDePromocion;
  /** Porcentaje de descuento, entero. */
  readonly porcentaje: number;
  readonly desde: Date;
  readonly hasta: Date;
  /** Multiplicador de puntos como texto exacto, o `null` si no suma extra. */
  readonly factorDePuntos: string | null;
  readonly estado: EstadoDePromocion;
}

const ANALGESICOS = { code: 'analgesicos', label: 'Analgésicos' } as const;
const ANTIALERGICOS = { code: 'antialergicos', label: 'Antialérgicos' } as const;
const VITAMINAS = { code: 'vitaminas', label: 'Vitaminas y suplementos' } as const;
const CUIDADO = { code: 'cuidado-personal', label: 'Cuidado personal' } as const;
const RESFRIO = { code: 'resfrio', label: 'Resfrío y gripe' } as const;

interface Semilla {
  readonly farmacia: string;
  readonly farmaciaVerificada: boolean;
  readonly ciudad: string;
  readonly titulo: string;
  readonly medicamento: string;
  readonly categoria: CategoriaDePromocion;
  readonly porcentaje: number;
  readonly desdeEnDias: number;
  readonly hastaEnDias: number;
  readonly factorDePuntos: string | null;
  readonly vista: boolean;
}

const SEMILLAS: readonly Semilla[] = [
  {
    farmacia: 'Farmacia Central',
    farmaciaVerificada: true,
    ciudad: 'Santa Cruz de la Sierra',
    titulo: 'Cuidado diario con 20 % menos',
    medicamento: 'Paracetamol 500 mg',
    categoria: ANALGESICOS,
    porcentaje: 20,
    desdeEnDias: -10,
    hastaEnDias: 20,
    factorDePuntos: '2',
    vista: false,
  },
  {
    farmacia: 'Farmacia Central',
    farmaciaVerificada: true,
    ciudad: 'Santa Cruz de la Sierra',
    titulo: 'Últimas unidades — vencimiento cercano',
    medicamento: 'Ibuprofeno 400 mg',
    categoria: ANALGESICOS,
    porcentaje: 35,
    desdeEnDias: -2,
    hastaEnDias: 5,
    factorDePuntos: null,
    vista: true,
  },
  {
    farmacia: 'Farmacia Chávez',
    farmaciaVerificada: true,
    ciudad: 'Santa Cruz de la Sierra',
    titulo: 'Vitamina C para toda la familia',
    medicamento: 'Vitamina C 1 g efervescente',
    categoria: VITAMINAS,
    porcentaje: 25,
    desdeEnDias: -5,
    hastaEnDias: 25,
    factorDePuntos: '3',
    vista: false,
  },
  {
    farmacia: 'Farmacia Chávez',
    farmaciaVerificada: true,
    ciudad: 'Montero',
    titulo: 'Protector solar al 2x1',
    medicamento: 'Protector solar FPS 50',
    categoria: CUIDADO,
    porcentaje: 50,
    desdeEnDias: -1,
    hastaEnDias: 14,
    factorDePuntos: null,
    vista: false,
  },
  {
    farmacia: 'Farmacia Bolivia',
    farmaciaVerificada: true,
    ciudad: 'La Paz',
    titulo: 'Temporada de resfríos',
    medicamento: 'Antigripal día y noche',
    categoria: RESFRIO,
    porcentaje: 15,
    desdeEnDias: -7,
    hastaEnDias: 30,
    factorDePuntos: '2',
    vista: true,
  },
  {
    farmacia: 'Farmacia Bolivia',
    farmaciaVerificada: true,
    ciudad: 'El Alto',
    titulo: 'Alergias de primavera',
    medicamento: 'Loratadina 10 mg',
    categoria: ANTIALERGICOS,
    porcentaje: 30,
    desdeEnDias: -3,
    hastaEnDias: 18,
    factorDePuntos: null,
    vista: false,
  },
  {
    farmacia: 'Farmacia San Pedro',
    farmaciaVerificada: false,
    ciudad: 'La Paz',
    titulo: 'Multivitamínico del mes',
    medicamento: 'Complejo B + zinc',
    categoria: VITAMINAS,
    porcentaje: 10,
    desdeEnDias: -12,
    hastaEnDias: 10,
    factorDePuntos: null,
    vista: true,
  },
  {
    farmacia: 'Farmacia Valle',
    farmaciaVerificada: true,
    ciudad: 'Cochabamba',
    titulo: 'Jarabe para la tos con descuento',
    medicamento: 'Ambroxol jarabe 120 ml',
    categoria: RESFRIO,
    porcentaje: 20,
    desdeEnDias: -4,
    hastaEnDias: 12,
    factorDePuntos: '2',
    vista: false,
  },
  {
    farmacia: 'Farmacia Valle',
    farmaciaVerificada: true,
    ciudad: 'Quillacollo',
    titulo: 'Crema hidratante al 30 %',
    medicamento: 'Crema hidratante corporal 200 ml',
    categoria: CUIDADO,
    porcentaje: 30,
    desdeEnDias: -6,
    hastaEnDias: 9,
    factorDePuntos: null,
    vista: true,
  },
  {
    farmacia: 'Farmacia Sucre',
    farmaciaVerificada: false,
    ciudad: 'Sucre',
    titulo: 'Analgésico para el dolor de cabeza',
    medicamento: 'Ácido acetilsalicílico 500 mg',
    categoria: ANALGESICOS,
    porcentaje: 15,
    desdeEnDias: -8,
    hastaEnDias: 16,
    factorDePuntos: null,
    vista: false,
  },
  {
    farmacia: 'Farmacia del Sur',
    farmaciaVerificada: true,
    ciudad: 'Tarija',
    titulo: 'Suplemento de hierro',
    medicamento: 'Sulfato ferroso 300 mg',
    categoria: VITAMINAS,
    porcentaje: 20,
    desdeEnDias: -9,
    hastaEnDias: 21,
    factorDePuntos: '2',
    vista: false,
  },
  {
    farmacia: 'Farmacia Central',
    farmaciaVerificada: true,
    ciudad: 'Santa Cruz de la Sierra',
    titulo: 'Campaña de invierno',
    medicamento: 'Cetirizina 10 mg',
    categoria: ANTIALERGICOS,
    porcentaje: 15,
    desdeEnDias: -60,
    hastaEnDias: -15,
    factorDePuntos: null,
    vista: true,
  },
  {
    farmacia: 'Farmacia Potosí',
    farmaciaVerificada: false,
    ciudad: 'Potosí',
    titulo: 'Descongestionante nasal',
    medicamento: 'Solución salina nasal 30 ml',
    categoria: RESFRIO,
    porcentaje: 25,
    desdeEnDias: -40,
    hastaEnDias: -2,
    factorDePuntos: null,
    vista: true,
  },
];

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Las promociones de ejemplo, fechadas respecto de `ahora`. */
export function promocionesDeEjemplo(ahora: Date = new Date()): readonly Promocion[] {
  const instante = ahora.getTime();
  return SEMILLAS.map((semilla, indice) => {
    const hasta = new Date(instante + semilla.hastaEnDias * UN_DIA);
    const vencida = hasta.getTime() < instante;
    return {
      id: `promo-${indice + 1}-${slug(semilla.titulo)}`,
      farmacia: semilla.farmacia,
      farmaciaVerificada: semilla.farmaciaVerificada,
      ciudad: semilla.ciudad,
      titulo: semilla.titulo,
      medicamento: semilla.medicamento,
      categoria: semilla.categoria,
      porcentaje: semilla.porcentaje,
      desde: new Date(instante + semilla.desdeEnDias * UN_DIA),
      hasta,
      factorDePuntos: semilla.factorDePuntos,
      estado: vencida ? 'vencida' : semilla.vista ? 'vista' : 'nueva',
    };
  });
}
