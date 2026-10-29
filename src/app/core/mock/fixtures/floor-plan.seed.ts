import { uuid } from '../mock-store';

/* ============================================================================
    Plano de ejemplo «Hospital de 2.º nivel» — la misma distribución que el seed
    `salud-db/demo/04-plano-hospital-ejemplo.sql` del modelo (CONTRATO-PLANO §7
    y §8): 88 espacios, 3 lienzos (planta baja 33 figuras, piso 1 51, campus 2) y
    136 elementos.

    Es un EJEMPLO DIDÁCTICO, no una norma ni una referencia de áreas mínimas.
    Cada tupla de `SPACE_ROWS` es una fila de la tabla temporal `_sp` del SQL, en
    el mismo orden; las coordenadas son las del SQL, en metros. Los elementos
    (muros, puertas, ventanas…) se generan con las mismas fórmulas.

    Los datos de ventilación de `TECHNICAL` son valores de DEMOSTRACIÓN para que
    la tarjeta tenga qué mostrar: no salen de ninguna norma.
    ========================================================================== */

export const PLAN_SITE_ID = uuid('plano-site-hospital');
/** Un lienzo «de otro tenant»: existe en el mundo pero la API contesta 404 igual que a un id inexistente. */
export const FOREIGN_PLAN_ID = uuid('plano-lienzo-otro-tenant');
export const FOREIGN_SPACE_ID = uuid('plano-espacio-otro-tenant');

export type FormCode = 'BUILDING' | 'LEVEL' | 'AREA' | 'WARD' | 'ROOM' | 'BED';

export interface SeedSpace {
  readonly key: string;
  readonly parent: string | null;
  readonly form: FormCode;
  readonly fn: string;
  /** Lienzo donde se dibuja; `null` para los pisos (son lienzos, no figuras). */
  readonly canvas: 'PB' | 'P1' | 'CP' | null;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly name: string;
  readonly unit: string | null;
  /** Área declarada; `null` = la dibujada. */
  readonly declared: number | null;
  /** Rotación (todo el ejemplo es axial). */
  readonly rotation: 0;
  /** Camas: posición de la cama dentro de su habitación. */
  readonly bedIndex?: number;
  readonly bedCount?: number;
}

type Row = readonly [
  key: string,
  parent: string | null,
  form: FormCode,
  fn: string,
  canvas: 'PB' | 'P1' | 'CP' | null,
  x: number,
  y: number,
  w: number,
  d: number,
  name: string,
  unit: string | null,
  decl: number | null,
];

const SPACE_ROWS: readonly Row[] = [
  ['BLD', null, 'BUILDING', 'BUILDING_GENERIC', 'CP', 20, 20, 60, 20, 'Edificio principal', null, null],
  ['PB', 'BLD', 'LEVEL', 'LEVEL_GENERIC', null, 0, 0, 0, 0, 'Planta baja', null, null],
  ['P1', 'BLD', 'LEVEL', 'LEVEL_GENERIC', null, 0, 0, 0, 0, 'Piso 1', null, null],
  ['PB-EME', 'PB', 'AREA', 'AREA_GENERIC', 'PB', 2, 2, 24, 8.5, 'Emergencias', 'EME', null],
  ['PB-TRI', 'PB-EME', 'ROOM', 'CONSULTING_ROOM', 'PB', 2, 2, 6, 8.5, 'Triaje', 'EME', null],
  ['PB-SHK', 'PB-EME', 'ROOM', 'EMERGENCY_BOX', 'PB', 8, 2, 6, 8.5, 'Sala de reanimación', 'EME', null],
  ['PB-BX1', 'PB-EME', 'ROOM', 'EMERGENCY_BOX', 'PB', 14, 2, 4, 8.5, 'Box 1', 'EME', null],
  ['PB-BX2', 'PB-EME', 'ROOM', 'EMERGENCY_BOX', 'PB', 18, 2, 4, 8.5, 'Box 2', 'EME', null],
  ['PB-BX3', 'PB-EME', 'ROOM', 'EMERGENCY_BOX', 'PB', 22, 2, 4, 8.5, 'Box 3', 'EME', null],
  ['PB-CEX', 'PB', 'AREA', 'AREA_GENERIC', 'PB', 26, 2, 20, 8.5, 'Consulta externa', 'CEX', null],
  ['PB-C1', 'PB-CEX', 'ROOM', 'CONSULTING_ROOM', 'PB', 26, 2, 4, 8.5, 'Consultorio 1 · Medicina general', 'CEX', null],
  ['PB-C2', 'PB-CEX', 'ROOM', 'CONSULTING_ROOM', 'PB', 30, 2, 4, 8.5, 'Consultorio 2 · Pediatría', 'CEX', null],
  ['PB-C3', 'PB-CEX', 'ROOM', 'CONSULTING_ROOM', 'PB', 34, 2, 4, 8.5, 'Consultorio 3 · Ginecología', 'CEX', 30],
  ['PB-C4', 'PB-CEX', 'ROOM', 'CONSULTING_ROOM', 'PB', 38, 2, 4, 8.5, 'Consultorio 4 · Cirugía', 'CEX', null],
  ['PB-C5', 'PB-CEX', 'ROOM', 'CONSULTING_ROOM', 'PB', 42, 2, 4, 8.5, 'Consultorio 5 · Medicina interna', 'CEX', null],
  ['PB-IMG', 'PB', 'AREA', 'AREA_GENERIC', 'PB', 46, 2, 16, 8.5, 'Imagenología', 'IMG', null],
  ['PB-RX', 'PB-IMG', 'ROOM', 'IMAGING_ROOM', 'PB', 46, 2, 8, 8.5, 'Sala de rayos X', 'IMG', null],
  ['PB-ECO', 'PB-IMG', 'ROOM', 'IMAGING_ROOM', 'PB', 54, 2, 8, 8.5, 'Sala de ecografía', 'IMG', null],
  ['PB-EOB', 'PB', 'AREA', 'AREA_GENERIC', 'PB', 2, 13.5, 20, 8.5, 'Observación y procedimientos', 'EME', null],
  ['PB-OBS', 'PB-EOB', 'ROOM', 'OBSERVATION', 'PB', 2, 13.5, 12, 8.5, 'Observación (4 camas)', 'EME', null],
  ['PB-YES', 'PB-EOB', 'ROOM', 'PROCEDURE_ROOM', 'PB', 14, 13.5, 8, 8.5, 'Procedimientos y yeso', 'CIR', null],
  ['PB-LAB', 'PB', 'AREA', 'AREA_GENERIC', 'PB', 22, 13.5, 16, 8.5, 'Laboratorio', 'LAB', null],
  ['PB-TOM', 'PB-LAB', 'ROOM', 'SAMPLE_COLLECTION', 'PB', 22, 13.5, 6, 8.5, 'Toma de muestras', 'LAB', null],
  ['PB-REC', 'PB-LAB', 'ROOM', 'LAB_AREA', 'PB', 28, 13.5, 4, 8.5, 'Recepción de muestras', 'LAB', null],
  ['PB-ANL', 'PB-LAB', 'ROOM', 'LAB_AREA', 'PB', 32, 13.5, 6, 8.5, 'Área analítica', 'LAB', null],
  ['PB-FAR', 'PB', 'AREA', 'AREA_GENERIC', 'PB', 38, 13.5, 8, 8.5, 'Farmacia', 'FAR', null],
  ['PB-FDI', 'PB-FAR', 'ROOM', 'PHARMACY', 'PB', 38, 13.5, 4, 8.5, 'Dispensación', 'FAR', null],
  ['PB-FDE', 'PB-FAR', 'ROOM', 'STORAGE', 'PB', 42, 13.5, 4, 8.5, 'Depósito de farmacia', 'FAR', null],
  ['PB-ADM', 'PB', 'AREA', 'AREA_GENERIC', 'PB', 46, 13.5, 16, 8.5, 'Admisión y administración', 'ADM', null],
  ['PB-ADC', 'PB-ADM', 'ROOM', 'OFFICE_ADMIN', 'PB', 46, 13.5, 5, 8.5, 'Admisión y caja', 'ADM', null],
  ['PB-DIR', 'PB-ADM', 'ROOM', 'OFFICE_ADMIN', 'PB', 51, 13.5, 4, 8.5, 'Dirección', 'ADM', null],
  ['PB-WAI', 'PB-ADM', 'ROOM', 'WAITING', 'PB', 55, 13.5, 7, 8.5, 'Sala de espera general', 'ADM', null],
  ['P1-MED', 'P1', 'WARD', 'WARD_GENERIC', 'P1', 2, 2, 20, 8.5, 'Internación Medicina', 'MED', null],
  ['P1-101', 'P1-MED', 'ROOM', 'INPATIENT_ROOM', 'P1', 2, 2, 5, 8.5, 'Habitación 101', 'MED', null],
  ['P1-102', 'P1-MED', 'ROOM', 'INPATIENT_ROOM', 'P1', 7, 2, 5, 8.5, 'Habitación 102', 'MED', null],
  ['P1-AIS', 'P1-MED', 'ROOM', 'ISOLATION_AIIR', 'P1', 12, 2, 5, 8.5, 'Aislamiento 1 (presión negativa)', 'MED', null],
  ['P1-ENM', 'P1-MED', 'ROOM', 'NURSE_STATION', 'P1', 17, 2, 5, 8.5, 'Control de enfermería Medicina', 'MED', null],
  ['P1-CIR', 'P1', 'WARD', 'WARD_GENERIC', 'P1', 22, 2, 20, 8.5, 'Internación Cirugía', 'CIR', null],
  ['P1-201', 'P1-CIR', 'ROOM', 'INPATIENT_ROOM', 'P1', 22, 2, 5, 8.5, 'Habitación 201', 'CIR', null],
  ['P1-202', 'P1-CIR', 'ROOM', 'INPATIENT_ROOM', 'P1', 27, 2, 5, 8.5, 'Habitación 202', 'CIR', null],
  ['P1-203', 'P1-CIR', 'ROOM', 'INPATIENT_ROOM', 'P1', 32, 2, 5, 8.5, 'Habitación 203', 'CIR', null],
  ['P1-ENC', 'P1-CIR', 'ROOM', 'NURSE_STATION', 'P1', 37, 2, 5, 8.5, 'Control de enfermería Cirugía', 'CIR', null],
  ['P1-PED', 'P1', 'WARD', 'WARD_GENERIC', 'P1', 42, 2, 20, 8.5, 'Internación Pediatría', 'PED', null],
  ['P1-301', 'P1-PED', 'ROOM', 'INPATIENT_ROOM', 'P1', 42, 2, 5, 8.5, 'Habitación 301', 'PED', null],
  ['P1-302', 'P1-PED', 'ROOM', 'INPATIENT_ROOM', 'P1', 47, 2, 5, 8.5, 'Habitación 302', 'PED', null],
  ['P1-303', 'P1-PED', 'ROOM', 'INPATIENT_ROOM', 'P1', 52, 2, 5, 8.5, 'Habitación 303', 'PED', null],
  ['P1-ENP', 'P1-PED', 'ROOM', 'NURSE_STATION', 'P1', 57, 2, 5, 8.5, 'Control de enfermería Pediatría', 'PED', null],
  ['P1-GIN', 'P1', 'WARD', 'WARD_GENERIC', 'P1', 2, 13.5, 20, 8.5, 'Gineco-obstetricia', 'GIN', null],
  ['P1-PA1', 'P1-GIN', 'ROOM', 'DELIVERY_ROOM', 'P1', 2, 13.5, 7, 8.5, 'Sala de partos 1', 'GIN', null],
  ['P1-PA2', 'P1-GIN', 'ROOM', 'DELIVERY_ROOM', 'P1', 9, 13.5, 7, 8.5, 'Sala de partos 2', 'GIN', null],
  ['P1-401', 'P1-GIN', 'ROOM', 'INPATIENT_ROOM', 'P1', 16, 13.5, 6, 8.5, 'Habitación 401 · puerperio', 'GIN', null],
  ['P1-AQX', 'P1', 'AREA', 'AREA_GENERIC', 'P1', 22, 13.5, 24, 8.5, 'Bloque quirúrgico', 'QX', null],
  ['P1-QX1', 'P1-AQX', 'ROOM', 'OPERATING_ROOM', 'P1', 22, 13.5, 10, 8.5, 'Quirófano 1', 'QX', null],
  ['P1-QX2', 'P1-AQX', 'ROOM', 'OPERATING_ROOM', 'P1', 32, 13.5, 10, 8.5, 'Quirófano 2', 'QX', 74],
  ['P1-ESR', 'P1-AQX', 'ROOM', 'STERILIZATION', 'P1', 42, 13.5, 4, 8.5, 'Central de esterilización', 'QX', null],
  ['P1-REC', 'P1', 'ROOM', 'RECOVERY_PACU', 'P1', 46, 13.5, 6, 8.5, 'Recuperación posanestésica', 'QX', null],
  ['P1-UTI', 'P1', 'ROOM', 'ICU_BAY', 'P1', 52, 13.5, 10, 8.5, 'Terapia intermedia', 'UTI', null],
];

/** (habitación, cantidad de camas, función de cama) — 30 camas. */
const BED_ROWS: readonly (readonly [string, number, string])[] = [
  ['PB-OBS', 4, 'BED_STANDARD'],
  ['P1-101', 2, 'BED_STANDARD'],
  ['P1-102', 2, 'BED_STANDARD'],
  ['P1-AIS', 1, 'BED_STANDARD'],
  ['P1-201', 2, 'BED_STANDARD'],
  ['P1-202', 2, 'BED_STANDARD'],
  ['P1-203', 2, 'BED_STANDARD'],
  ['P1-301', 2, 'BED_STANDARD'],
  ['P1-302', 2, 'BED_STANDARD'],
  ['P1-303', 2, 'BED_STANDARD'],
  ['P1-401', 2, 'BED_STANDARD'],
  ['P1-REC', 3, 'BED_STANDARD'],
  ['P1-UTI', 4, 'BED_ICU'],
];

export const UNIT_ROWS: readonly (readonly [string, string])[] = [
  ['EME', 'Emergencias'],
  ['CEX', 'Consulta externa'],
  ['IMG', 'Imagenología'],
  ['LAB', 'Laboratorio'],
  ['FAR', 'Farmacia'],
  ['ADM', 'Admisión y administración'],
  ['MED', 'Medicina interna'],
  ['CIR', 'Cirugía'],
  ['PED', 'Pediatría'],
  ['GIN', 'Gineco-obstetricia'],
  ['QX', 'Bloque quirúrgico'],
  ['UTI', 'Terapia intermedia'],
];

export const unitId = (code: string): string => uuid(`plano-unit-${code}`);
export const spaceId = (key: string): string => uuid(`plano-sp-${key}`);
export const placementId = (key: string): string => uuid(`plano-pl-${key}`);
export const planId = (code: 'PB' | 'P1' | 'CP'): string => uuid(`plano-plan-${code}`);
export const elementId = (key: string): string => uuid(`plano-el-${key}`);

function buildSpaces(): SeedSpace[] {
  const list: SeedSpace[] = SPACE_ROWS.map(([key, parent, form, fn, canvas, x, y, w, d, name, unit, declared]) => ({
    key, parent, form, fn, canvas, x, y, w, d, name, unit, declared, rotation: 0,
  }));
  const rooms = new Map(list.map((s) => [s.key, s]));
  for (const [roomKey, count, fn] of BED_ROWS) {
    const room = rooms.get(roomKey)!;
    for (let g = 1; g <= count; g += 1) {
      list.push({
        key: `${roomKey}-C${g}`,
        parent: roomKey,
        form: 'BED',
        fn,
        canvas: room.canvas,
        // Cama 1,0 × 2,0 m, cabecera contra el muro: norte en la franja norte, sur en la franja sur.
        x: room.x + (room.w * g) / (count + 1) - 0.5,
        y: (room.y > 12 ? room.y + room.d - 1.2 : room.y + 1.2) - 1,
        w: 1,
        d: 2,
        name: `Cama ${g} · ${room.name}`,
        unit: room.unit,
        declared: 2,
        rotation: 0,
        bedIndex: g,
        bedCount: count,
      });
    }
  }
  // Estacionamiento: raíz del árbol, polígono (se dibuja aparte, con sus vértices).
  list.push({
    key: 'ESTAC', parent: null, form: 'AREA', fn: 'AREA_GENERIC', canvas: 'CP', x: 8, y: 50, w: 54, d: 16,
    name: 'Estacionamiento', unit: null, declared: null, rotation: 0,
  });
  return list;
}

export const SEED_SPACES: readonly SeedSpace[] = buildSpaces();
export const SEED_SPACE_BY_KEY: ReadonlyMap<string, SeedSpace> = new Map(SEED_SPACES.map((s) => [s.key, s]));

/** Vértices del estacionamiento (trapecio) — el único POLYGON del ejemplo. */
export const ESTAC_VERTICES: readonly (readonly [number, number])[] = [
  [8, 50],
  [62, 50],
  [56, 66],
  [8, 66],
];

export interface SeedPlanRow {
  readonly code: 'PB' | 'P1' | 'CP';
  readonly anchor: string | null;
  readonly name: string;
  readonly widthM: number;
  readonly heightM: number;
  readonly elevationM: number | null;
  readonly gridSizeM: number;
}

export const SEED_PLANS: readonly SeedPlanRow[] = [
  { code: 'CP', anchor: null, name: 'Campus', widthM: 100, heightM: 70, elevationM: null, gridSizeM: 1 },
  { code: 'PB', anchor: 'PB', name: 'Planta baja', widthM: 64, heightM: 26, elevationM: 0, gridSizeM: 0.5 },
  { code: 'P1', anchor: 'P1', name: 'Piso 1', widthM: 64, heightM: 26, elevationM: 3.6, gridSizeM: 0.5 },
];

/* ---- elementos (muros, puertas, ventanas, circulación…) --------------------- */

export interface SeedElement {
  readonly id: string;
  readonly canvas: 'PB' | 'P1' | 'CP';
  readonly kind: 'WALL' | 'DOOR' | 'WINDOW' | 'CIRCULATION' | 'ELEVATOR' | 'STAIRS' | 'ANNOTATION';
  readonly zOrder: number;
  readonly vertices?: readonly (readonly [number, number])[];
  readonly thicknessM?: number;
  readonly hostId?: string;
  readonly offsetM?: number;
  readonly widthM?: number;
  readonly swing?: 'LEFT' | 'RIGHT' | 'DOUBLE' | 'SLIDING' | 'NONE';
  readonly connectsKey?: string;
  readonly verticalLinkCode?: string;
  readonly label?: string;
}

function doorWidth(fn: string): number {
  if (fn === 'OPERATING_ROOM' || fn === 'WAITING') return 2;
  if (['INPATIENT_ROOM', 'ISOLATION_AIIR', 'DELIVERY_ROOM', 'OBSERVATION', 'ICU_BAY', 'RECOVERY_PACU'].includes(fn)) return 1.2;
  return 1;
}

function buildElements(): SeedElement[] {
  const out: SeedElement[] = [];
  for (const canvas of ['PB', 'P1'] as const) {
    out.push({
      id: elementId(`wall:ext:${canvas}`), canvas, kind: 'WALL', zOrder: 30, thicknessM: 0.3, label: 'Muro exterior',
      vertices: [[2, 2], [62, 2], [62, 22], [2, 22], [2, 2]],
    });
  }
  const rooms = SEED_SPACES.filter((s) => s.form === 'ROOM' && (s.canvas === 'PB' || s.canvas === 'P1'));
  for (const s of rooms) {
    const canvas = s.canvas as 'PB' | 'P1';
    out.push({
      id: elementId(`wall:${s.key}`), canvas, kind: 'WALL', zOrder: 30, thicknessM: 0.12,
      vertices: [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.d], [s.x, s.y + s.d], [s.x, s.y]],
    });
  }
  for (const s of rooms) {
    const dw = doorWidth(s.fn);
    if (s.w < dw + 0.5) continue;
    out.push({
      id: elementId(`door:${s.key}`), canvas: s.canvas as 'PB' | 'P1', kind: 'DOOR', zOrder: 40,
      hostId: elementId(`wall:${s.key}`),
      // Franja norte → arista inferior del lazo; franja sur → arista superior.
      offsetM: s.y < 10 ? s.w + s.d + (s.w - dw) / 2 : (s.w - dw) / 2,
      widthM: dw,
      swing: s.fn === 'OPERATING_ROOM' ? 'DOUBLE' : s.fn === 'WAITING' ? 'NONE' : 'LEFT',
      connectsKey: s.key,
    });
  }
  for (const s of rooms) {
    if (['STERILIZATION', 'SAMPLE_COLLECTION'].includes(s.fn) || s.w < 4) continue;
    out.push({
      id: elementId(`win:${s.key}`), canvas: s.canvas as 'PB' | 'P1', kind: 'WINDOW', zOrder: 35,
      hostId: elementId(`wall:ext:${s.canvas}`),
      offsetM: s.y < 10 ? s.x + s.w / 2 - 2 - 0.8 : 60 + 20 + (62 - (s.x + s.w / 2)) - 0.8,
      widthM: 1.6,
    });
  }
  for (const canvas of ['PB', 'P1'] as const) {
    out.push({ id: elementId(`circ:${canvas}`), canvas, kind: 'CIRCULATION', zOrder: 5, label: 'Pasillo central', vertices: [[2, 10.5], [54, 10.5], [54, 13.5], [2, 13.5]] });
    out.push({ id: elementId(`elev:${canvas}`), canvas, kind: 'ELEVATOR', zOrder: 15, label: 'Ascensor', verticalLinkCode: 'ASC-1', vertices: [[54, 10.5], [58, 10.5], [58, 13.5], [54, 13.5]] });
    out.push({ id: elementId(`stair:${canvas}`), canvas, kind: 'STAIRS', zOrder: 15, label: 'Escalera A', verticalLinkCode: 'ESC-A', vertices: [[58, 10.5], [62, 10.5], [62, 13.5], [58, 13.5]] });
  }
  for (const canvas of ['PB', 'P1', 'CP'] as const) {
    out.push({ id: elementId(`north:${canvas}`), canvas, kind: 'ANNOTATION', zOrder: 60, label: 'N ↑', vertices: [[61, 24]] });
  }
  out.push({ id: elementId('road'), canvas: 'CP', kind: 'CIRCULATION', zOrder: 5, label: 'Calle de acceso', vertices: [[0, 44], [100, 44], [100, 48], [0, 48]] });
  return out;
}

export const SEED_ELEMENTS: readonly SeedElement[] = buildElements();
