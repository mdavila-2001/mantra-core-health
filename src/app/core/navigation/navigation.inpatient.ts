import type { AppSection } from './navigation.types';

/* ============================================================================
    Internación (franja F2 de la infraestructura hospitalaria): el tablero de
    camas y la cola de limpieza, en el dominio «Atención».

    Viven en su propio archivo porque `navigation.map.ts` está congelado por
    `scripts/check-max-lines.mjs` (un ratchet: no puede crecer). El registro las
    esparce en `APP_SECTIONS` justo después de «Intervenciones», así que el orden
    del menú es el que se declara acá.

    Los `roles` son los del token que dejan entrar a la pantalla; **no son el
    permiso**. Enfermería, limpieza y mantenimiento son asignaciones delegadas
    que el token no trae: quien las tiene llega con `USER` (o con su rol
    clínico). Qué puede hacer cada quien lo decide la API en cada petición y lo
    declara en `viewer`; un rol sin alcance recibe 403 o 404 y la pantalla lo
    dice (S5/S6). El paciente no entra.
    ========================================================================== */

const ROLES_DE_LA_OPERACION = ['SECURITY_ADMIN', 'PERIOP_ADMIN', 'PERIOP_NURSE', 'CLINICIAN', 'PRACTITIONER', 'USER'] as const;

export const INPATIENT_SECTIONS: readonly AppSection[] = [
  {
    path: 'inpatient/bed-board',
    label: 'Tablero de camas',
    group: 'Atención',
    icon: 'hospital',
    roles: ROLES_DE_LA_OPERACION,
    availability: 'disponible',
    summary: 'Vea qué camas están libres, ocupadas, bloqueadas, sucias o en aislamiento, y desde cuándo.',
    module: 'M14 practice',
  },
  {
    path: 'inpatient/cleaning',
    label: 'Limpieza de camas',
    group: 'Atención',
    icon: 'clipboard',
    roles: ROLES_DE_LA_OPERACION,
    availability: 'disponible',
    summary: 'Tome, inicie y termine las órdenes de limpieza; la supervisión inspecciona y libera la cama.',
    module: 'M14 practice',
  },
];
