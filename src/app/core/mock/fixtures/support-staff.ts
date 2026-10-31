import { IDS, TENANT_CLINICA, TENANT_CONSULTORIO, TENANT_HOSPITAL } from '../mock-session';
import { uuid } from '../mock-store';

/* ============================================================================
    Personal de apoyo (la secretaria) en la maqueta: el catálogo de cada
    hospital —doctores y pisos— y las secretarias sembradas.

    Lo sembrado deja recorrible el flujo entero con las cuentas de prueba (ver
    `support-staff.store.ts`):

    - `secretaria@alovida.mock` (Rosa, CI 6001001) ya trabaja en el Hospital San
      Lucas con la Dra. Rojas y el Piso 2, y tiene dos invitaciones de la
      Clínica Los Olivos para aceptar.
    - `admin@alovida.mock` (Clínica Los Olivos) tiene una solicitud de Lucía
      esperando.
    - `medica@alovida.mock` tiene a Rosa en su equipo y una solicitud de Lucía
      para aceptar.

    El `practitionerRoleAssignmentId` de la Dra. Rojas es el de sus
    vinculaciones de `practice.handlers` (`ra-olivos`, `ra-sanlucas`): con él la
    médica invita a su secretaria desde «Mi secretaría».
    ========================================================================== */

/** `CatalogEntry` de la API. */
export interface EntradaDeCatalogo {
  readonly id: string;
  readonly name: string;
  readonly practiceSiteId: string;
  readonly practitionerProfileId?: string;
}

export interface CatalogoDeApoyo {
  readonly sites: readonly EntradaDeCatalogo[];
  readonly floors: readonly EntradaDeCatalogo[];
  readonly practitioners: readonly EntradaDeCatalogo[];
}

const DR_PAZ = uuid('hpid-dr-jorge-paz');
const DRA_VACA = uuid('hpid-dra-silvia-vaca');

function sede(tenant: string, nombre: string): EntradaDeCatalogo {
  const id = uuid(`apoyo-sede-${tenant}`);
  return { id, name: nombre, practiceSiteId: id };
}

function piso(tenant: string, codigo: string, nombre: string): EntradaDeCatalogo {
  return { id: uuid(`apoyo-piso-${tenant}-${codigo}`), name: nombre, practiceSiteId: uuid(`apoyo-sede-${tenant}`) };
}

function doctor(tenant: string, perfil: string, nombre: string, vinculacion?: string): EntradaDeCatalogo {
  return {
    id: vinculacion ?? uuid(`apoyo-pra-${tenant}-${perfil}`),
    name: nombre,
    practiceSiteId: uuid(`apoyo-sede-${tenant}`),
    practitionerProfileId: perfil,
  };
}

export const CATALOGOS_DE_APOYO: Readonly<Record<string, CatalogoDeApoyo>> = {
  [TENANT_HOSPITAL]: {
    sites: [sede(TENANT_HOSPITAL, 'Hospital San Lucas — Sede central')],
    floors: [
      piso(TENANT_HOSPITAL, 'PB', 'Planta baja — Admisión y emergencias'),
      piso(TENANT_HOSPITAL, 'P1', 'Piso 1 — Pediatría'),
      piso(TENANT_HOSPITAL, 'P2', 'Piso 2 — Cardiología'),
      piso(TENANT_HOSPITAL, 'P3', 'Piso 3 — Internación'),
    ],
    practitioners: [
      doctor(TENANT_HOSPITAL, IDS.medica.practitionerProfileId, 'Dra. Valeria Rojas Mendoza', uuid('ra-sanlucas')),
      doctor(TENANT_HOSPITAL, DR_PAZ, 'Dr. Jorge Paz Antelo'),
      doctor(TENANT_HOSPITAL, DRA_VACA, 'Dra. Silvia Vaca Díez'),
    ],
  },
  [TENANT_CLINICA]: {
    sites: [sede(TENANT_CLINICA, 'Clínica Los Olivos')],
    floors: [
      piso(TENANT_CLINICA, 'PB', 'Planta baja — Consultorios externos'),
      piso(TENANT_CLINICA, 'P1', 'Piso 1 — Ginecología'),
      piso(TENANT_CLINICA, 'P2', 'Piso 2 — Traumatología'),
    ],
    practitioners: [
      doctor(TENANT_CLINICA, IDS.medica.practitionerProfileId, 'Dra. Valeria Rojas Mendoza', uuid('ra-olivos')),
      doctor(TENANT_CLINICA, IDS.medicoNuevo.practitionerProfileId, 'Dr. Ramiro Céspedes Villca'),
      doctor(TENANT_CLINICA, DR_PAZ, 'Dr. Jorge Paz Antelo'),
    ],
  },
  [TENANT_CONSULTORIO]: {
    sites: [sede(TENANT_CONSULTORIO, 'Consultorio Dra. Rojas')],
    floors: [piso(TENANT_CONSULTORIO, 'C1', 'Consultorio — Planta baja')],
    practitioners: [doctor(TENANT_CONSULTORIO, IDS.medica.practitionerProfileId, 'Dra. Valeria Rojas Mendoza')],
  },
};

/** La secretaria sembrada. */
export const SECRETARIA = {
  userId: uuid('user-secretaria-rosa'),
  personId: uuid('person-secretaria-rosa'),
  email: 'secretaria@alovida.mock',
  nationalId: '6001001',
  displayName: 'Rosa Choque Mamani',
} as const;

/** Otra secretaria, la que pide sumarse a la clínica. */
export const SECRETARIA_PENDIENTE = {
  userId: uuid('user-secretaria-lucia'),
  personId: uuid('person-secretaria-lucia'),
  email: 'lucia.rocha@alovida.mock',
  nationalId: '6001002',
  displayName: 'Lucía Rocha Justiniano',
} as const;

/** Un doctor del catálogo por su vinculación, en cualquier hospital. */
export function doctorPorVinculacion(id: string): { readonly tenantId: string; readonly doctor: EntradaDeCatalogo } | undefined {
  for (const [tenantId, catalogo] of Object.entries(CATALOGOS_DE_APOYO)) {
    const doctor = catalogo.practitioners.find((d) => d.id === id);
    if (doctor !== undefined) return { tenantId, doctor };
  }
  return undefined;
}
