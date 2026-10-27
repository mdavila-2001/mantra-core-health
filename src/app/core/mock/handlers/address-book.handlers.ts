import { displayOf } from '../fixtures/concepts';
import { patientList, type PacienteSimulado } from '../fixtures/people';
import {
  notFound,
  preconditionFailed,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { Coleccion, cuerpo, nuevoId } from '../mock-store';
import { pacienteDeSesion } from './profiles.handlers';

/* ============================================================================
    Libreta de direcciones del paciente y calle desde el punto del mapa (pedido
    del cliente del 26/10/2026), para la maqueta y el sitio demo.

    Es un DOBLE del contrato de la API (`/profiles/patients/me/addresses` y
    `POST /public/geo/reverse`): mismas formas, mismas reglas visibles —la
    preferida primero, el domicilio no se quita, tope de diez guardadas, un id
    ajeno responde 404—. No prueba la API: la prueba de la API está en su repo.
    ========================================================================== */

/** Tope de guardadas, el mismo que la API (`SAVED_ADDRESSES_MAX`). */
const TOPE_DE_GUARDADAS = 10;

interface GuardadaSimulada {
  readonly id: string;
  readonly pacienteId: string;
  readonly label: string;
  readonly lines?: string;
  readonly municipalityConceptId: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly isPreferred: boolean;
  readonly orden: number;
}

const guardadas = new Coleccion<GuardadaSimulada>([], 'libreta-direcciones');

const idDelDomicilio = (p: PacienteSimulado) => `domicilio-${p.id}`;

function domicilioDe(p: PacienteSimulado) {
  return {
    id: idDelDomicilio(p),
    kind: 'HOME' as const,
    label: 'Casa',
    ...(p.direccion ? { lines: p.direccion } : {}),
    ...(p.municipioId ? { city: displayOf(p.municipioId), municipalityConceptId: p.municipioId } : {}),
    ...(typeof p.homeLat === 'number' && typeof p.homeLng === 'number'
      ? { latitude: p.homeLat, longitude: p.homeLng }
      : {}),
  };
}

/** La libreta como la devuelve la API: la preferida primero. */
function libretaDe(p: PacienteSimulado) {
  const propias = guardadas
    .todos()
    .filter((g) => g.pacienteId === p.id)
    .sort((a, b) => a.orden - b.orden);
  const hayMarcada = propias.some((g) => g.isPreferred);
  const casa = { ...domicilioDe(p), isPreferred: !hayMarcada };
  const resto = propias.map((g) => ({
    id: g.id,
    kind: 'SAVED' as const,
    label: g.label,
    ...(g.lines ? { lines: g.lines } : {}),
    city: displayOf(g.municipalityConceptId),
    municipalityConceptId: g.municipalityConceptId,
    ...(g.latitude !== undefined && g.longitude !== undefined
      ? { latitude: g.latitude, longitude: g.longitude }
      : {}),
    isPreferred: g.isPreferred,
  }));
  const preferida = resto.find((g) => g.isPreferred);
  return preferida
    ? [preferida, casa, ...resto.filter((g) => g !== preferida)]
    : [casa, ...resto];
}

function desmarcarTodas(pacienteId: string): void {
  for (const g of guardadas.todos()) {
    if (g.pacienteId === pacienteId && g.isPreferred) {
      guardadas.actualizar(g.id, { isPreferred: false });
    }
  }
}

function punto(c: Record<string, unknown>): { latitude?: number; longitude?: number } {
  return typeof c['latitude'] === 'number' && typeof c['longitude'] === 'number'
    ? { latitude: c['latitude'], longitude: c['longitude'] }
    : {};
}

function propia(request: MockRequest, p: PacienteSimulado): GuardadaSimulada | undefined {
  const g = guardadas.get(request.params['id'] ?? '');
  return g?.pacienteId === p.id ? g : undefined;
}

export function registrarLibretaDeDirecciones(router: MockRouter): void {
  router.get('/profiles/patients/me/addresses', (request) => {
    const p = pacienteDeSesion(request);
    return p === undefined ? notFound('No tiene perfil de paciente') : libretaDe(p);
  });

  router.post('/profiles/patients/me/addresses', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('No tiene perfil de paciente');
    const c = cuerpo<Record<string, unknown>>(request);
    const label = typeof c['label'] === 'string' ? c['label'].trim() : '';
    const municipio = c['municipalityConceptId'];
    if (label === '' || typeof municipio !== 'string') {
      return validation('Faltan el nombre o la localidad', [
        ...(label === '' ? [{ field: 'label', message: 'Póngale un nombre' }] : []),
        ...(typeof municipio !== 'string'
          ? [{ field: 'municipalityConceptId', message: 'Elija la localidad' }]
          : []),
      ]);
    }
    const propias = guardadas.todos().filter((g) => g.pacienteId === p.id);
    if (propias.length >= TOPE_DE_GUARDADAS) {
      return preconditionFailed(
        `Puede guardar hasta ${TOPE_DE_GUARDADAS} direcciones además de su domicilio.`,
      );
    }
    if (c['isPreferred'] === true) desmarcarTodas(p.id);
    guardadas.agregar({
      id: nuevoId(),
      pacienteId: p.id,
      label,
      ...(typeof c['lines'] === 'string' && c['lines'].trim() !== ''
        ? { lines: c['lines'].trim() }
        : {}),
      municipalityConceptId: municipio,
      ...punto(c),
      isPreferred: c['isPreferred'] === true,
      orden: Date.now() + propias.length,
    });
    return libretaDe(p);
  });

  router.patch('/profiles/patients/me/addresses/:id', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('No tiene perfil de paciente');
    const c = cuerpo<Record<string, unknown>>(request);
    if (request.params['id'] === idDelDomicilio(p)) {
      if (c['label'] !== undefined) return preconditionFailed('El domicilio tiene nombre fijo.');
      const coordenadas = punto(c);
      patientList.actualizar(p.id, {
        ...(typeof c['lines'] === 'string' ? { direccion: c['lines'].trim() } : {}),
        ...(typeof c['municipalityConceptId'] === 'string'
          ? { municipioId: c['municipalityConceptId'] }
          : {}),
        ...(coordenadas.latitude !== undefined
          ? { homeLat: coordenadas.latitude, homeLng: coordenadas.longitude }
          : {}),
      });
      return libretaDe(patientList.get(p.id) ?? p);
    }
    const g = propia(request, p);
    if (g === undefined) return notFound('Dirección no encontrada');
    guardadas.actualizar(g.id, {
      ...(typeof c['label'] === 'string' && c['label'].trim() !== ''
        ? { label: c['label'].trim() }
        : {}),
      ...(typeof c['lines'] === 'string' ? { lines: c['lines'].trim() || undefined } : {}),
      ...(typeof c['municipalityConceptId'] === 'string'
        ? { municipalityConceptId: c['municipalityConceptId'] }
        : {}),
      ...punto(c),
    });
    return libretaDe(p);
  });

  router.delete('/profiles/patients/me/addresses/:id', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('No tiene perfil de paciente');
    if (request.params['id'] === idDelDomicilio(p)) {
      return preconditionFailed('Su domicilio no se puede quitar: puede corregirlo.');
    }
    const g = propia(request, p);
    if (g === undefined) return notFound('Dirección no encontrada');
    guardadas.borrar(g.id);
    return libretaDe(p);
  });

  router.put('/profiles/patients/me/addresses/:id/preferred', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('No tiene perfil de paciente');
    const esCasa = request.params['id'] === idDelDomicilio(p);
    const g = esCasa ? undefined : propia(request, p);
    if (!esCasa && g === undefined) return notFound('Dirección no encontrada');
    desmarcarTodas(p.id);
    if (g !== undefined) guardadas.actualizar(g.id, { isPreferred: true });
    return libretaDe(p);
  });

  /**
   * La calle de un punto. La maqueta no sale a ningún geocodificador, así que
   * contesta una calle **declarada simulada** —con la atribución que lo dice—
   * en vez de inventar una que parezca real. Acepta cualquier punto del planeta,
   * como la API (mantra-core-health-api#1027); fuera de rango, 400.
   */
  router.post('/public/geo/reverse', (request) => {
    const c = cuerpo<Record<string, unknown>>(request);
    const lat = c['latitude'];
    const lng = c['longitude'];
    if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return validation('El punto no es una coordenada válida', [
        { field: 'latitude', message: 'Coordenada fuera de rango' },
      ]);
    }
    // Un recuadro chico de zona rural en La Guardia (Santa Cruz),
    // declarado: ahí la maqueta responde sin calle ni distrito, para poder
    // mostrar «sin calle» y «sin distrito» sin vaciar ningún otro punto.
    if (lat >= -17.95 && lat <= -17.9 && lng >= -63.35 && lng <= -63.28) {
      return {
        found: false,
        countryCode: 'BO',
        adminAreas: { level1: 'Santa Cruz (simulado)' },
        attribution: 'Simulado en la maqueta: sin geocodificador',
      };
    }
    const numero = (Math.abs(Math.round(lat * 1000)) % 900) + 100;
    const distrito = (Math.abs(Math.round(lng * 100)) % 12) + 1;
    return {
      found: true,
      line: `Calle de demostración ${numero}, Distrito ${distrito} (simulada)`,
      road: 'Calle de demostración',
      houseNumber: String(numero),
      neighbourhood: `Distrito ${distrito} (simulado)`,
      // El país, como la API: dentro del recuadro de Bolivia se declara «BO»;
      // afuera no se sabe sin geocodificador, y no se inventa.
      ...(lat >= -23.5 && lat <= -9.2 && lng >= -70 && lng <= -57
        ? {
            countryCode: 'BO',
            adminAreas: { district: `Distrito ${distrito} (simulado)` },
          }
        : {}),
      attribution: 'Simulado en la maqueta: sin geocodificador',
    };
  });
}
