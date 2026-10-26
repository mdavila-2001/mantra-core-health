/* ============================================================================
    Secciones del nav lateral, por módulo.

    ARCHIVO GENERADO por scripts/port-vistas-alovida.mjs. Sale del propio nav de
    las maquetas: cada pantalla de la bóveda trae desplegado el módulo al que
    pertenece, y de ahí se recoge la lista. Los rótulos y el orden son los de
    la bóveda, no una interpretación.
    ========================================================================== */

/** Una entrada del submenú de un módulo. */
export interface SeccionAlovida {
  readonly etiqueta: string;
  readonly ruta: string;
}

/** Un módulo del nav, con sus secciones maquetadas. */
export interface ModuloAlovida {
  readonly segmento: string;
  readonly rotulo: string;
  readonly secciones: readonly SeccionAlovida[];
}

export const MODULOS_ALOVIDA: readonly ModuloAlovida[] = [
  {
    segmento: "shared-data",
    rotulo: "Datos compartidos",
    secciones: [
      {
        etiqueta: "Archivos",
        ruta: "/shared-data/files-list"
      },
      {
        etiqueta: "Puntos de contacto",
        ruta: "/shared-data/contact-points-list"
      },
      {
        etiqueta: "Direcciones",
        ruta: "/shared-data/addresses-list"
      },
      {
        etiqueta: "Identificadores",
        ruta: "/shared-data/identifiers-list"
      },
      {
        etiqueta: "Operación interna",
        ruta: "/shared-data/internal-versions-list"
      }
    ]
  },
  {
    segmento: "vocabulary",
    rotulo: "Terminología",
    secciones: [
      {
        etiqueta: "Sistemas de códigos",
        ruta: "/vocabulary/code-systems-list"
      },
      {
        etiqueta: "Conceptos",
        ruta: "/vocabulary/concepts-list"
      },
      {
        etiqueta: "Conjuntos de valor",
        ruta: "/vocabulary/value-sets-list"
      },
      {
        etiqueta: "Versiones",
        ruta: "/vocabulary/versions-list"
      },
      {
        etiqueta: "Políticas de catálogo",
        ruta: "/vocabulary/catalog-policies-list"
      },
      {
        etiqueta: "Consulta de concepto",
        ruta: "/vocabulary/concept-lookup-list"
      },
      {
        etiqueta: "Traducción entre catálogos",
        ruta: "/vocabulary/catalog-translation-form"
      },
      {
        etiqueta: "Expansión de conjunto de valores",
        ruta: "/vocabulary/value-set-expansion-form"
      }
    ]
  },
  {
    segmento: "institutions",
    rotulo: "Organizaciones",
    secciones: [
      {
        etiqueta: "Organizaciones",
        ruta: "/institutions/organizations-list"
      },
      {
        etiqueta: "Membresías",
        ruta: "/institutions/memberships-list"
      },
      {
        etiqueta: "Sucursales",
        ruta: "/institutions/branches-list"
      },
      {
        etiqueta: "Organizaciones hijas",
        ruta: "/institutions/child-organizations-form"
      }
    ]
  },
  {
    segmento: "people",
    rotulo: "Personas",
    secciones: [
      {
        etiqueta: "Pacientes",
        ruta: "/people/patients-list"
      },
      {
        etiqueta: "Personas",
        ruta: "/people/people-list"
      },
      {
        etiqueta: "Profesionales",
        ruta: "/people/practitioners-list"
      },
      {
        etiqueta: "Credenciales",
        ruta: "/people/credentials-list"
      }
    ]
  },
  {
    segmento: "access",
    rotulo: "Identidad y accesos",
    secciones: [
      {
        etiqueta: "Relaciones de cuidado",
        ruta: "/access/care-relationships-list"
      },
      {
        etiqueta: "Representaciones legales",
        ruta: "/access/legal-representations-list"
      },
      {
        etiqueta: "Accesos clínicos",
        ruta: "/access/clinical-access-list"
      },
      {
        etiqueta: "Accesos del paciente",
        ruta: "/access/patient-clinical-access-list"
      },
      {
        etiqueta: "Acceso de emergencia",
        ruta: "/access/emergency-access-form"
      },
      {
        etiqueta: "Decisiones",
        ruta: "/access/decisions-evaluate"
      },
      {
        etiqueta: "Caché del PDP",
        ruta: "/access/cache-invalidate"
      },
      {
        etiqueta: "Categorías de permiso",
        ruta: "/access/permission-categories-list"
      },
      {
        etiqueta: "Permisos",
        ruta: "/access/permissions-list"
      },
      {
        etiqueta: "Roles",
        ruta: "/access/roles-list"
      },
      {
        etiqueta: "Asignaciones de rol",
        ruta: "/access/role-assignments-list"
      },
      {
        etiqueta: "Concesiones de permiso",
        ruta: "/access/permission-grants-list"
      },
      {
        etiqueta: "Alcance de recurso",
        ruta: "/access/resource-scope-list"
      },
      {
        etiqueta: "Políticas de acceso",
        ruta: "/access/access-policies-list"
      }
    ]
  }
] as const;

/** Índice por segmento, que es lo que trae la URL. */
export const MODULO_POR_SEGMENTO = new Map<string, ModuloAlovida>(
  MODULOS_ALOVIDA.map((modulo) => [modulo.segmento, modulo]),
);
