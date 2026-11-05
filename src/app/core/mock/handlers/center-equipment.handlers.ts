import type {
  CenterEquipment,
  CenterEquipmentInput,
  CenterScheduleView,
  EquipmentStatus,
} from '../../data-access/diagnostic-units/center-schedule.types';
import { esCodigoDeModalidad, modalidadDeEquipo, type ModalityCode } from '../../data-access/diagnostic-units/modalidades';
import { estadosDeEquipos, PUESTOS_DE_EXTRACCION } from '../fixtures/centros';
import { conflict, isMockReply, notFound, unprocessable, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { Coleccion, cuerpo, nuevoId, uuid } from '../mock-store';
import { equipoDe, type UnidadSimulada } from './diagnostics.handlers';

/* ============================================================================
    The devices (production lines) of a center, and their CRUD from «Horarios
    y equipos»: simulator mirror of `POST|PUT|DELETE
    /diagnostic-units/:unitId/equipment[/:equipmentId]` for `development,demo`.

    The seeded devices come from `equipoDe()`; what the center adds or edits
    lives in `equiposDelCentro` (one row per touched device). A seeded device
    cannot be removed (409, like the API once a device has records).
    ========================================================================== */

interface EquipoTocado extends CenterEquipment {
  readonly unitId: string;
}

export const equiposDelCentro = new Coleccion<EquipoTocado>().persistirEn('mock.centros.equipos');

/** El término del glosario de cada tipo de equipo. */
const TERMINO_DE_EQUIPO: Readonly<Record<string, string>> = {
  US: 'equipo-ecografo',
  XR: 'equipo-rayos-x',
  MR: 'equipo-resonador-magnetico',
  CT: 'equipo-tomografo',
  MG: 'equipo-mamografo',
  DX: 'equipo-densitometro-oseo',
  ANALYZER: 'equipo-analizador-de-laboratorio',
  SAMPLING_STATION: 'equipo-puesto-de-extraccion',
};

/** El id con el que el glosario sirve un término: el mismo que deriva `glossary-shards.ts`. */
const conceptoDelGlosario = (slug: string | undefined): string | null =>
  slug === undefined ? null : uuid(`concept-glossary-${slug}`);

/** Como la API: sin tipo de equipo en el catálogo para resonancia, ECG ni toma de muestras. */
const SIN_TIPO: readonly ModalityCode[] = ['RM', 'ECG', 'LAB'];

function sembrados(u: UnidadSimulada): CenterEquipment[] {
  const propios = equipoDe(u).map((e): CenterEquipment => ({
    id: e.id,
    name: e.type.display,
    manufacturer: e.manufacturer,
    model: e.model,
    modalityCode: modalidadDeEquipo(e.type.code),
    status: e.operationalStatus.code as EquipmentStatus,
    glossaryConceptId: conceptoDelGlosario(TERMINO_DE_EQUIPO[e.type.code]),
  }));
  if (u.kind !== 'LABORATORY') return propios;
  // En un laboratorio el turno lo limitan los puestos de extracción, no los
  // analizadores: la muestra se procesa después, en lote.
  const puestos = Array.from({ length: PUESTOS_DE_EXTRACCION }, (_, i): CenterEquipment => ({
    id: uuid(`equipment-${u.id}-puesto-${i}`),
    name: `Puesto de extracción ${i + 1}`,
    manufacturer: null,
    model: null,
    modalityCode: 'LAB',
    status: 'OPERATIONAL',
    glossaryConceptId: conceptoDelGlosario(TERMINO_DE_EQUIPO['SAMPLING_STATION']),
  }));
  return [...puestos, ...propios];
}

/** Los equipos del centro con su estado vigente y su modalidad. */
export function equiposDe(u: UnidadSimulada): readonly CenterEquipment[] {
  const tocados = equiposDelCentro.filtrar((e) => e.unitId === u.id);
  const base = sembrados(u).map((e) => tocados.find((t) => t.id === e.id) ?? e);
  const nuevos = tocados.filter((t) => !base.some((e) => e.id === t.id));
  return [...base, ...nuevos].map(({ id, name, manufacturer, model, serialNumber, modalityCode, status, glossaryConceptId }) => ({
      id,
      name,
      manufacturer,
      model,
      serialNumber: serialNumber ?? null,
      modalityCode,
      status: estadosDeEquipos.get(id)?.status ?? status,
      glossaryConceptId,
    }));
}

function leerEquipo(body: unknown): CenterEquipmentInput | MockReply {
  const datos = body as Partial<CenterEquipmentInput>;
  const name = typeof datos.name === 'string' ? datos.name.trim() : '';
  if (name === '') return unprocessable('Escriba el nombre del equipo.');
  const modalityCode = datos.modalityCode ?? null;
  if (modalityCode !== null && (!esCodigoDeModalidad(modalityCode) || SIN_TIPO.includes(modalityCode))) {
    return unprocessable('El catálogo todavía no tiene un tipo de equipo para esa modalidad.');
  }
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return { name, manufacturer: texto(datos.manufacturer), serialNumber: texto(datos.serialNumber), modalityCode };
}

/** Las rutas de alta, edición y baja; `centro` resuelve la unidad y su permiso. */
export function registrarEquiposDeCentro(
  router: MockRouter,
  centro: (unitId: string, request: MockRequest) => UnidadSimulada | MockReply,
  vista: (u: UnidadSimulada) => CenterScheduleView,
): void {
  router.post('/diagnostic-units/:unitId/equipment', (request) => {
    const u = centro(request.params['unitId']!, request);
    if (isMockReply(u)) return u;
    const datos = leerEquipo(cuerpo(request));
    if (isMockReply(datos)) return datos;
    equiposDelCentro.agregar({
      id: nuevoId(),
      unitId: u.id,
      ...datos,
      model: datos.name,
      status: 'OPERATIONAL',
      glossaryConceptId: null,
    });
    return vista(u);
  });

  router.put('/diagnostic-units/:unitId/equipment/:equipmentId', (request) => {
    const u = centro(request.params['unitId']!, request);
    if (isMockReply(u)) return u;
    const actual = equiposDe(u).find((e) => e.id === request.params['equipmentId']);
    if (actual === undefined) return notFound('Equipo no encontrado');
    const datos = leerEquipo(cuerpo(request));
    if (isMockReply(datos)) return datos;
    equiposDelCentro.agregar({ ...actual, ...datos, model: datos.name, unitId: u.id });
    return vista(u);
  });

  router.delete('/diagnostic-units/:unitId/equipment/:equipmentId', (request) => {
    const u = centro(request.params['unitId']!, request);
    if (isMockReply(u)) return u;
    const actual = equiposDe(u).find((e) => e.id === request.params['equipmentId']);
    if (actual === undefined) return notFound('Equipo no encontrado');
    // Like the API: a seeded device already has records behind it.
    if (sembrados(u).some((e) => e.id === actual.id)) {
      return conflict('El equipo ya tiene registros asociados: márquelo «Fuera de servicio» en lugar de quitarlo.');
    }
    equiposDelCentro.borrar(actual.id);
    return vista(u);
  });
}
