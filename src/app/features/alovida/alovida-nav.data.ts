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
    segmento: "datos-compartidos",
    rotulo: "Datos compartidos",
    secciones: [
      {
        etiqueta: "Archivos",
        ruta: "/datos-compartidos/archivos-listado"
      },
      {
        etiqueta: "Puntos de contacto",
        ruta: "/datos-compartidos/puntos-de-contacto-listado"
      },
      {
        etiqueta: "Direcciones",
        ruta: "/datos-compartidos/direcciones-listado"
      },
      {
        etiqueta: "Identificadores",
        ruta: "/datos-compartidos/identificadores-listado"
      },
      {
        etiqueta: "Operación interna",
        ruta: "/datos-compartidos/versiones-internas-listado"
      }
    ]
  },
  {
    segmento: "terminologia",
    rotulo: "Terminología",
    secciones: [
      {
        etiqueta: "Sistemas de códigos",
        ruta: "/terminologia/sistemas-de-codigos-listado"
      },
      {
        etiqueta: "Conceptos",
        ruta: "/terminologia/conceptos-listado"
      },
      {
        etiqueta: "Conjuntos de valor",
        ruta: "/terminologia/conjuntos-de-valor-listado"
      },
      {
        etiqueta: "Versiones",
        ruta: "/terminologia/versiones-listado"
      },
      {
        etiqueta: "Políticas de catálogo",
        ruta: "/terminologia/politicas-de-catalogo-listado"
      },
      {
        etiqueta: "Consulta de concepto",
        ruta: "/terminologia/consulta-de-concepto-listado"
      },
      {
        etiqueta: "Traducción entre catálogos",
        ruta: "/terminologia/traduccion-entre-catalogos-formulario"
      },
      {
        etiqueta: "Expansión de conjunto de valores",
        ruta: "/terminologia/expansion-de-conjunto-de-valores-formulario"
      }
    ]
  },
  {
    segmento: "directorio",
    rotulo: "Organizaciones",
    secciones: [
      {
        etiqueta: "Organizaciones",
        ruta: "/directorio/organizaciones-listado"
      },
      {
        etiqueta: "Membresías",
        ruta: "/directorio/membresias-listado"
      },
      {
        etiqueta: "Sucursales",
        ruta: "/directorio/sucursales-listado"
      },
      {
        etiqueta: "Organizaciones hijas",
        ruta: "/directorio/organizaciones-hijas-formulario"
      }
    ]
  },
  {
    segmento: "personas",
    rotulo: "Personas",
    secciones: [
      {
        etiqueta: "Pacientes",
        ruta: "/personas/pacientes-listado"
      },
      {
        etiqueta: "Personas",
        ruta: "/personas/personas-listado"
      },
      {
        etiqueta: "Profesionales",
        ruta: "/personas/profesionales-listado"
      },
      {
        etiqueta: "Credenciales",
        ruta: "/personas/credenciales-listado"
      }
    ]
  },
  {
    segmento: "accesos",
    rotulo: "Identidad y accesos",
    secciones: [
      {
        etiqueta: "Relaciones de cuidado",
        ruta: "/accesos/relaciones-de-cuidado-listado"
      },
      {
        etiqueta: "Representaciones legales",
        ruta: "/accesos/representaciones-legales-listado"
      },
      {
        etiqueta: "Accesos clínicos",
        ruta: "/accesos/accesos-clinicos-listado"
      },
      {
        etiqueta: "Accesos del paciente",
        ruta: "/accesos/accesos-clinicos-del-paciente-listado"
      },
      {
        etiqueta: "Acceso de emergencia",
        ruta: "/accesos/acceso-de-emergencia-formulario"
      },
      {
        etiqueta: "Decisiones",
        ruta: "/accesos/decisiones-evaluar"
      },
      {
        etiqueta: "Caché del PDP",
        ruta: "/accesos/cache-invalidar"
      },
      {
        etiqueta: "Categorías de permiso",
        ruta: "/accesos/categorias-de-permiso-listado"
      },
      {
        etiqueta: "Permisos",
        ruta: "/accesos/permisos-listado"
      },
      {
        etiqueta: "Roles",
        ruta: "/accesos/roles-listado"
      },
      {
        etiqueta: "Asignaciones de rol",
        ruta: "/accesos/asignaciones-de-rol-listado"
      },
      {
        etiqueta: "Concesiones de permiso",
        ruta: "/accesos/concesiones-de-permiso-listado"
      },
      {
        etiqueta: "Alcance de recurso",
        ruta: "/accesos/alcance-de-recurso-listado"
      },
      {
        etiqueta: "Políticas de acceso",
        ruta: "/accesos/politicas-de-acceso-listado"
      }
    ]
  }
] as const;

/** Índice por segmento, que es lo que trae la URL. */
export const MODULO_POR_SEGMENTO = new Map<string, ModuloAlovida>(
  MODULOS_ALOVIDA.map((modulo) => [modulo.segmento, modulo]),
);
