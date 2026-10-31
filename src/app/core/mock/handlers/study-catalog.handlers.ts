import { ESTUDIOS_DEL_CATALOGO, estudioDelCatalogo, plegar } from '../fixtures/study-catalog';
import { notFound, validation, type MockRouter } from '../mock-router';
import { texto } from '../mock-store';

/* ============================================================================
    `GET /clinical/study-catalog` y `GET /clinical/study-catalog/:conceptId`
    (C1 y C2) en el simulador.

    Mismo contrato que la API: orden alfabético sin tildes, `q` exige que
    **todas** sus palabras aparezcan (nombre, sinónimo, código o componente),
    paginación por cursor opaco y `limit` de 1 a 100 (25 por omisión).
    ========================================================================== */

const FAMILIAS = ['LAB', 'IMAGING', 'CARDIO', 'PATHOLOGY', 'PROCEDURE'];
const LIMITE_POR_OMISION = 25;
const LIMITE_MAXIMO = 100;

/** El cursor es la posición, en base64: opaco para quien lo recibe. */
function decodificar(cursor: string): number | null {
  try {
    const n = Number(atob(cursor).replace(/^pos:/, ''));
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function registrarCatalogoDeEstudios(router: MockRouter): void {
  router.get('/clinical/study-catalog', ({ query }) => {
    const family = texto(query, 'family');
    if (family !== null && !FAMILIAS.includes(family)) {
      return validation('family debe ser LAB, IMAGING, CARDIO, PATHOLOGY o PROCEDURE.');
    }
    const crudo = texto(query, 'limit');
    const limit = crudo === null ? LIMITE_POR_OMISION : Number(crudo);
    if (!Number.isInteger(limit) || limit < 1 || limit > LIMITE_MAXIMO) {
      return validation(`limit debe ser un entero de 1 a ${LIMITE_MAXIMO}.`);
    }
    const q = texto(query, 'q');
    if (q !== null && q.length > 100) return validation('q admite hasta 100 caracteres.');
    const cursor = texto(query, 'cursor');
    const desde = cursor === null ? 0 : decodificar(cursor);
    if (desde === null) return validation('El cursor de paginación no es válido');

    const palabras = q === null ? [] : plegar(q).split(/\s+/).filter(Boolean);
    const coinciden = ESTUDIOS_DEL_CATALOGO.filter(
      (e) =>
        (family === null || e.item.family === family) &&
        palabras.every((p) => e.busqueda.includes(p)),
    );
    const pagina = coinciden.slice(desde, desde + limit);
    const siguiente = desde + limit;
    return {
      items: pagina.map((e) => e.item),
      count: pagina.length,
      limit,
      nextCursor: siguiente < coinciden.length ? btoa(`pos:${siguiente}`) : null,
    };
  });

  router.get('/clinical/study-catalog/:conceptId', ({ params }) => {
    const estudio = estudioDelCatalogo(params['conceptId']!);
    if (estudio === undefined) return notFound('El concepto no es un estudio del catálogo');
    return { ...estudio.item, ...estudio.detalle };
  });
}
