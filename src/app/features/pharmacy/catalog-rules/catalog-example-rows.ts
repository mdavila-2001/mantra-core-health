import type { ProductFields } from './catalog.rules';

/*
 * Las filas de ejemplo de la plantilla del CSV de productos. Viven aparte de
 * las reglas (`catalog.rules.ts`) porque son datos, no reglas.
 */

/** Tres filas de ejemplo para la plantilla: una con cada caso típico. */
export const EXAMPLE_ROWS: readonly ProductFields[] = [
  {
    codigo: 'PAR-500-20',
    marca: 'Paracetamol Ejemplo',
    generico: 'Paracetamol',
    concentracion: '500 mg',
    presentacion: 'Caja x 20 comprimidos',
    receta: 'no',
    cadenaDeFrio: 'no',
    codigoDeBarras: '',
    precio: '18,50',
    categoria: 'Medicamentos',
    descripcion: 'Analgésico y antifebril de venta libre.',
    disponible: 'sí',
  },
  {
    codigo: 'AMX-500-21',
    marca: '',
    generico: 'Amoxicilina',
    concentracion: '500 mg',
    presentacion: 'Caja x 21 cápsulas',
    receta: 'sí',
    medicamento: 'Amoxicilina',
    cadenaDeFrio: 'no',
    codigoDeBarras: '',
    precio: '42',
    categoria: 'Medicamentos',
    descripcion: '',
    disponible: 'agotado',
  },
  {
    codigo: 'INS-NPH-10',
    marca: 'Insulina Ejemplo NPH',
    generico: 'Insulina humana isofánica',
    concentracion: '100 UI/ml',
    presentacion: 'Frasco de 10 ml',
    receta: 'sí',
    cadenaDeFrio: 'sí',
    codigoDeBarras: '',
    precio: '185',
    categoria: 'Medicamentos',
    descripcion: 'Mantener refrigerado entre 2 y 8 °C.',
    disponible: '12',
  },
];
