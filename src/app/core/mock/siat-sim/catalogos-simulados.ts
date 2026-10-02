/* ============================================================================
    Los catálogos paramétricos del SIAT **simulado**.

    En el SIAT real estos valores llegan por los servicios de sincronización
    (`sincronizarParametricaTipoMetodoPago`, `sincronizarListaLeyendasFactura`,
    `sincronizarParametricaMotivoAnulacion`…), que exigen token del SIN. **No
    se consultaron** y no se inventan como si fueran reales: cada entrada
    declara de dónde sale.

    - `EJEMPLO_OFICIAL`: el valor aparece en un documento publicado por el SIN
      (XML/PDF de ejemplo o nota técnica); se cita dónde.
    - `SIMULADO`: valor sintético del simulador, sin correspondencia afirmada
      con el catálogo real.
    ========================================================================== */

export type OrigenDeCatalogo = 'EJEMPLO_OFICIAL' | 'SIMULADO';

export interface EntradaDeCatalogo {
  readonly codigo: number;
  readonly descripcion: string;
  readonly origen: OrigenDeCatalogo;
  /** Dónde aparece, si `origen` es `EJEMPLO_OFICIAL`. */
  readonly fuente?: string;
}

export interface LeyendaDeCatalogo {
  readonly descripcionLeyenda: string;
  readonly origen: OrigenDeCatalogo;
  readonly fuente?: string;
}

export interface CatalogosFiscales {
  readonly metodosDePago: readonly EntradaDeCatalogo[];
  readonly tiposDeDocumentoDeIdentidad: readonly EntradaDeCatalogo[];
  readonly unidadesDeMedida: readonly EntradaDeCatalogo[];
  readonly monedas: readonly EntradaDeCatalogo[];
  readonly motivosDeAnulacion: readonly EntradaDeCatalogo[];
  readonly leyendas: readonly LeyendaDeCatalogo[];
  readonly simulated: true;
}

const NOTA_HOSPITAL =
  'Nota de la página oficial «Factura Hospitales/Clínicas»: unidadMedida 58 («unidad servicio») para servicios.';

export const CATALOGOS_SIMULADOS: CatalogosFiscales = {
  metodosDePago: [
    { codigo: 1, descripcion: 'EFECTIVO (catálogo simulado)', origen: 'SIMULADO' },
    { codigo: 2, descripcion: 'TARJETA (catálogo simulado)', origen: 'SIMULADO' },
    { codigo: 3, descripcion: 'TRANSFERENCIA / QR (catálogo simulado)', origen: 'SIMULADO' },
  ],
  tiposDeDocumentoDeIdentidad: [
    // El XSD admite 1–5; el significado de cada código no se leyó en fuente oficial.
    { codigo: 1, descripcion: 'CÉDULA DE IDENTIDAD (catálogo simulado)', origen: 'SIMULADO' },
    { codigo: 5, descripcion: 'NIT (catálogo simulado)', origen: 'SIMULADO' },
  ],
  unidadesDeMedida: [
    { codigo: 58, descripcion: 'UNIDAD (SERVICIOS)', origen: 'EJEMPLO_OFICIAL', fuente: NOTA_HOSPITAL },
    { codigo: 1, descripcion: 'UNIDAD (catálogo simulado)', origen: 'SIMULADO' },
  ],
  monedas: [{ codigo: 1, descripcion: 'BOLIVIANO (catálogo simulado)', origen: 'SIMULADO' }],
  motivosDeAnulacion: [
    { codigo: 1, descripcion: 'FACTURA MAL EMITIDA (catálogo simulado)', origen: 'SIMULADO' },
    { codigo: 2, descripcion: 'DATOS DEL COMPRADOR ERRÓNEOS (catálogo simulado)', origen: 'SIMULADO' },
    { codigo: 3, descripcion: 'SERVICIO O PRODUCTO NO ENTREGADO (catálogo simulado)', origen: 'SIMULADO' },
  ],
  leyendas: [
    {
      descripcionLeyenda:
        'Ley N° 453: Tienes derecho a recibir información sobre las características y contenidos de los servicios que utilices.',
      origen: 'EJEMPLO_OFICIAL',
      fuente: 'XML de ejemplo oficial facturaComputarizadaCompraVenta.xml (CompraVentaXML.zip)',
    },
    {
      descripcionLeyenda:
        'Ley N° 453: Los servicios deben suministrarse en condiciones de inocuidad, calidad y seguridad.',
      origen: 'EJEMPLO_OFICIAL',
      fuente: 'PDF de ejemplo oficial «factura HospitalClinica.pdf»',
    },
  ],
  simulated: true,
};

export function existeEnCatalogo(catalogo: readonly EntradaDeCatalogo[], codigo: number): boolean {
  return catalogo.some((e) => e.codigo === codigo);
}
