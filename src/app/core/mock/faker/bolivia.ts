import type { fakerES } from '@faker-js/faker';

import { DEPARTAMENTO, MUNICIPIO } from '../fixtures/conceptos';

/* ============================================================================
    Lo boliviano, que `faker` no trae.

    El locale `es` de `faker` es de España: sus DNI, sus provincias, sus
    teléfonos y sus calles. Nada de eso pasa por paciente en Santa Cruz. Este
    módulo es la capa que sí: cédulas con extensión departamental, NIT,
    celulares +591, municipios reales tomados del **mismo catálogo** que usa la
    aplicación (`fixtures/conceptos.ts`), y direcciones con las avenidas que
    existen.

    Regla que se hereda de `demo-presets.ts` y que aquí también manda: nada de
    inventar códigos. Un municipio que la terminología no conoce es un dato que
    la pantalla no puede pintar, y el fallo aparece lejos de acá.
    ========================================================================== */

type Faker = typeof fakerES;

export interface LugarBoliviano {
  readonly ciudad: string;
  readonly municipioId: string;
  readonly departamentoId: string;
  /** La letra que va detrás de la cédula: «4567890 SC». */
  readonly extension: string;
  readonly lat: number;
  readonly lng: number;
  readonly avenidas: readonly string[];
}

/**
 * Las ciudades donde vive la demostración.
 *
 * Coordenadas reales: el mapa (`app-map`, Leaflet) pinta pines de verdad y con
 * coordenadas inventadas se ven en medio del Atlántico. Los identificadores
 * salen del catálogo, no de constantes propias.
 */
export const LUGARES: readonly LugarBoliviano[] = [
  {
    ciudad: 'Santa Cruz de la Sierra',
    municipioId: MUNICIPIO['SC-SCZ']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:SC']!,
    extension: 'SC',
    lat: -17.7833,
    lng: -63.1821,
    avenidas: ['Banzer', 'San Martín', 'Alemana', 'Cristo Redentor', 'Busch', 'Roca y Coronado', 'Irala', 'Beni'],
  },
  {
    ciudad: 'La Paz',
    municipioId: MUNICIPIO['LP-LPZ']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:LP']!,
    extension: 'LP',
    lat: -16.4897,
    lng: -68.1193,
    avenidas: ['Arce', '6 de Agosto', 'Camacho', 'Mariscal Santa Cruz', 'Busch', 'Saavedra', 'Ballivián'],
  },
  {
    ciudad: 'Cochabamba',
    municipioId: MUNICIPIO['CB-CBB']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:CB']!,
    extension: 'CB',
    lat: -17.3895,
    lng: -66.1568,
    avenidas: ['Heroínas', 'Ayacucho', 'América', 'Blanco Galindo', 'Pando', 'Oquendo'],
  },
  {
    ciudad: 'El Alto',
    municipioId: MUNICIPIO['LP-ELA']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:LP']!,
    extension: 'LP',
    lat: -16.5,
    lng: -68.1633,
    avenidas: ['6 de Marzo', 'Juan Pablo II', 'Bolivia', 'Litoral', 'Alfonso Ugarte'],
  },
  {
    ciudad: 'Sucre',
    municipioId: MUNICIPIO['CH-SRE']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:CH']!,
    extension: 'CH',
    lat: -19.0421,
    lng: -65.2559,
    avenidas: ['Hernando Siles', 'Venezuela', 'Jaime Mendoza', 'del Maestro'],
  },
  {
    ciudad: 'Tarija',
    municipioId: MUNICIPIO['TJ-TJA']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:TJ']!,
    extension: 'TJ',
    lat: -21.5355,
    lng: -64.7296,
    avenidas: ['La Paz', 'Domingo Paz', 'Jaime Paz Zamora', 'Víctor Paz'],
  },
  {
    ciudad: 'Oruro',
    municipioId: MUNICIPIO['OR-ORU']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:OR']!,
    extension: 'OR',
    lat: -17.9833,
    lng: -67.15,
    avenidas: ['6 de Octubre', 'Bolívar', 'España', 'Dehene'],
  },
  {
    ciudad: 'Potosí',
    municipioId: MUNICIPIO['PT-PTS']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:PT']!,
    extension: 'PT',
    lat: -19.5836,
    lng: -65.7531,
    avenidas: ['Universitaria', 'Cívica', 'Serrudo', 'Villazón'],
  },
  {
    ciudad: 'Trinidad',
    municipioId: MUNICIPIO['BE-TRI']!,
    departamentoId: DEPARTAMENTO['geo:bo:department:BE']!,
    extension: 'BE',
    lat: -14.8333,
    lng: -64.9,
    avenidas: ['Cipriano Barace', '6 de Agosto', 'Bolívar', 'Santa Cruz'],
  },
];

/** Las tres ciudades donde vive la mayor parte de la demostración. */
export const LUGARES_PRINCIPALES = LUGARES.slice(0, 3);

export function lugar(f: Faker, soloPrincipales = false): LugarBoliviano {
  return f.helpers.arrayElement(soloPrincipales ? LUGARES_PRINCIPALES : LUGARES);
}

/**
 * Cédula de identidad.
 *
 * Siete dígitos y la extensión del departamento donde se emitió, que es como
 * se escribe y como la piden los formularios de identidad (`identity-assurance`).
 * El rango arranca en 1.000.000 porque los de seis dígitos son de otra época y
 * chocan con las validaciones de longitud mínima.
 */
export function cedula(f: Faker, lugarDeEmision?: LugarBoliviano): string {
  const numero = f.number.int({ min: 1_200_000, max: 9_899_999 });
  const ext = lugarDeEmision?.extension ?? f.helpers.arrayElement(LUGARES).extension;
  return `${numero} ${ext}`;
}

/** Sólo el número, para los campos que lo guardan sin extensión. */
export function cedulaSimple(f: Faker): string {
  return String(f.number.int({ min: 1_200_000, max: 9_899_999 }));
}

/**
 * NIT.
 *
 * Once o doce dígitos: el de una persona natural suele ser su cédula seguida
 * de «01x». Facturación lo pide entero, sin separadores.
 */
export function nit(f: Faker): string {
  return `${f.number.int({ min: 1_200_000, max: 9_899_999 })}01${f.number.int({ min: 1, max: 9 })}`;
}

/**
 * Celular.
 *
 * En Bolivia empiezan por 6 o por 7 y tienen ocho dígitos. Se escribe con el
 * prefijo internacional porque es lo que guarda el modelo y lo que espera
 * `app-phone-input`.
 */
export function celular(f: Faker): string {
  const prefijo = f.helpers.arrayElement(['6', '7']);
  return `+591 ${prefijo}${f.number.int({ min: 1_000_000, max: 9_999_999 })}`;
}

/** Fijo, con el indicativo de la ciudad (3 SCZ, 2 LPZ, 4 CBB…). */
export function telefonoFijo(f: Faker, l: LugarBoliviano): string {
  const indicativo =
    l.extension === 'SC' || l.extension === 'BE' || l.extension === 'PD'
      ? '3'
      : l.extension === 'LP' || l.extension === 'OR' || l.extension === 'PT'
        ? '2'
        : '4';
  return `+591 ${indicativo}${f.number.int({ min: 100_000, max: 999_999 })}`;
}

/** Dirección con avenida o calle real de la ciudad. */
export function direccion(f: Faker, l: LugarBoliviano): string {
  const tipo = f.helpers.arrayElement(['Av.', 'Av.', 'Calle']);
  const via =
    tipo === 'Av.'
      ? f.helpers.arrayElement(l.avenidas)
      : f.helpers.arrayElement(['Libertad', 'Sucre', 'Ayacucho', 'Junín', 'Bolívar', 'Warnes', 'Independencia', '21 de Mayo']);
  const numero = f.number.int({ min: 45, max: 2400 });
  const anillo =
    l.extension === 'SC' && f.datatype.boolean(0.4) ? `, ${f.number.int({ min: 1, max: 8 })}.º anillo` : '';
  return `${tipo} ${via} N.º ${numero}${anillo}`;
}

/** Un punto dentro de la ciudad, no en medio del Atlántico. */
export function coordenada(f: Faker, l: LugarBoliviano): { lat: number; lng: number } {
  return {
    lat: Number((l.lat + f.number.float({ min: -0.045, max: 0.045, fractionDigits: 4 })).toFixed(6)),
    lng: Number((l.lng + f.number.float({ min: -0.045, max: 0.045, fractionDigits: 4 })).toFixed(6)),
  };
}

/** Matrícula del Colegio Médico. */
export function matricula(f: Faker): string {
  return `MP-${f.number.int({ min: 1200, max: 9800 })}`;
}

export const ASEGURADORAS = [
  'Seguros Andina',
  'La Vitalicia',
  'Alianza Seguros',
  'BISA Seguros',
  'Nacional Seguros',
  'Credinform',
  'Univida',
] as const;

export const PLANES = ['Plan Integral', 'Plan Familiar', 'Plan Oro', 'Plan Básico', 'Plan Ejecutivo'] as const;

export const BANCOS = [
  'Banco Nacional de Bolivia',
  'Banco Mercantil Santa Cruz',
  'Banco BISA',
  'Banco Unión',
  'Banco Ganadero',
  'Banco Fassil',
  'Banco Económico',
] as const;

export const ORGANIZACIONES_SALUD = [
  'Clínica Los Olivos',
  'Hospital San Lucas',
  'Hospital Japonés',
  'Clínica Foianini',
  'Clínica Incor',
  'Hospital Univalle',
  'Centro Médico Boliviano Belga',
  'Clínica Niño Jesús',
] as const;

/**
 * Un importe en bolivianos, como **texto**.
 *
 * Los importes viajan como decimal en texto en todo el modelo contable
 * (ver la cabecera de `accounting.types.ts`): convertirlos a `number` acá sería
 * empezar a perder precisión en el sitio donde se inventa el dato.
 */
export function bolivianos(f: Faker, min: number, max: number): string {
  return f.number.float({ min, max, fractionDigits: 2 }).toFixed(2);
}
