/* ============================================================================
    Los esquemas de los documentos sector que conoce el simulador.

    Transcritos **a mano y en orden** de los XSD oficiales del SIN, modalidad
    Computarizada en Línea (D-FACT-SIAT, CA-2):

    - Compra y Venta (sector 1): `CompraVentaXML.zip`
      sha256 bd64249dd0e6a6527dc44c06e785888c20287df8948a65c1ad7093d3c9d99867
    - Hospitales/Clínicas (sector 17): `HospitalClinicaXML.zip`
      sha256 2b4596d0c6637157e8ea5f5b388f2e77818b0008aba2d07b2d36ce71ddc667a6

    ambos de https://siatinfo.impuestos.gob.bo/images/archivos_tecnicos/archivos_apoyo/
    (descargados el 2026-09-26). El orden importa: el XSD usa `xs:sequence`.

    El simulador **no** ejecuta el XSD —no hay validador de esquemas en el
    navegador—: comprueba lo que estas tablas declaran (orden, obligatoriedad,
    tipo, rango y longitud). El SIN real aplica el XSD completo.
    ========================================================================== */

export type XsdFieldType = 'integer' | 'string' | 'decimal' | 'dateTime';

export interface XsdField {
  readonly nombre: string;
  readonly tipo: XsdFieldType;
  /** `nillable="true"`: puede ir como `<campo xsi:nil="true"/>`. */
  readonly nillable: boolean;
  /** Enteros con `bigint` cuando el XSD supera `Number.MAX_SAFE_INTEGER`. */
  readonly min?: number | bigint;
  readonly max?: number | bigint;
  readonly minLength?: number;
  readonly maxLength?: number;
  /** `fixed="…"`: el único valor admitido. */
  readonly fijo?: string;
}

export interface SectorDocumentSchema {
  readonly codigoDocumentoSector: number;
  readonly nombre: string;
  /** Elemento raíz en Computarizada en Línea (modalidad 2). */
  readonly raizComputarizada: string;
  /** Elemento raíz en Electrónica en Línea (modalidad 1): lleva firma, no se simula. */
  readonly raizElectronica: string;
  readonly cabecera: readonly XsdField[];
  readonly detalle: readonly XsdField[];
  readonly detalleMaximo: number;
  /**
   * `false` = transcrito y documentado, pero el simulador no emite en este
   * sector (ver {@link motivoInactivo}).
   */
  readonly activo: boolean;
  readonly motivoInactivo: string | null;
}

// ---- tipos repetidos del XSD ---------------------------------------------

const AMOUNT = { tipo: 'decimal' } as const;
const NON_NEGATIVE_AMOUNT = { tipo: 'decimal', min: 0 } as const;
const text = (minLength: number, maxLength: number) => ({ tipo: 'string', minLength, maxLength }) as const;
const integerType = (min: number | bigint, max: number | bigint) => ({ tipo: 'integer', min, max }) as const;

function field(nombre: string, forma: Omit<XsdField, 'nombre' | 'nillable'>, nillable = false): XsdField {
  return { nombre, nillable, ...forma };
}

/** La cabecera común, con el hueco donde el sector 17 inserta `modalidadServicio`. */
function header(codigoDocumentoSector: number, extrasAntesDelMetodoDePago: readonly XsdField[]): readonly XsdField[] {
  return [
    field('nitEmisor', integerType(1, 9_999_999_999_999)),
    field('razonSocialEmisor', text(1, 200)),
    field('municipio', text(1, 25)),
    field('telefono', text(1, 25), true),
    field('numeroFactura', integerType(1, 9_999_999_999)),
    field('cuf', text(1, 100)),
    field('cufd', text(1, 100)),
    field('codigoSucursal', integerType(0, 9999)),
    field('direccion', text(1, 500)),
    field('codigoPuntoVenta', integerType(0, 9999), true),
    field('fechaEmision', { tipo: 'dateTime' }),
    field('nombreRazonSocial', text(1, 500), true),
    field('codigoTipoDocumentoIdentidad', integerType(1, 5)),
    field('numeroDocumento', text(1, 20)),
    field('complemento', text(0, 5), true),
    field('codigoCliente', text(1, 100)),
    ...extrasAntesDelMetodoDePago,
    field('codigoMetodoPago', integerType(1, 308)),
    field('numeroTarjeta', integerType(0, 9_999_999_999_999_999n), true),
    field('montoTotal', AMOUNT),
    field('montoTotalSujetoIva', NON_NEGATIVE_AMOUNT),
    field('codigoMoneda', integerType(1, 154)),
    field('tipoCambio', AMOUNT),
    field('montoTotalMoneda', AMOUNT),
    field('montoGiftCard', NON_NEGATIVE_AMOUNT, true),
    field('descuentoAdicional', NON_NEGATIVE_AMOUNT, true),
    field('codigoExcepcion', integerType(0, 1), true),
    field('cafc', text(1, 50), true),
    field('leyenda', text(1, 200)),
    field('usuario', text(1, 100)),
    field('codigoDocumentoSector', { tipo: 'integer', fijo: String(codigoDocumentoSector) }),
  ];
}

/** Sector 1 · Factura de Compra y Venta — la de farmacia y la de la consulta ambulatoria (CA-1). */
export const PURCHASE_SALE_SCHEMA: SectorDocumentSchema = {
  codigoDocumentoSector: 1,
  nombre: 'Factura de Compra y Venta',
  raizComputarizada: 'facturaComputarizadaCompraVenta',
  raizElectronica: 'facturaElectronicaCompraVenta',
  cabecera: header(1, []),
  detalle: [
    field('actividadEconomica', text(1, 10)),
    field('codigoProductoSin', integerType(1, 99_999_999)),
    field('codigoProducto', text(1, 50)),
    field('descripcion', text(1, 500)),
    field('cantidad', AMOUNT),
    field('unidadMedida', integerType(1, 200)),
    field('precioUnitario', AMOUNT),
    field('montoDescuento', NON_NEGATIVE_AMOUNT, true),
    field('subTotal', AMOUNT),
    field('numeroSerie', text(0, 1500), true),
    field('numeroImei', text(0, 1500), true),
  ],
  detalleMaximo: 500,
  activo: true,
  motivoInactivo: null,
};

/**
 * Sector 17 · Factura de Hospitales/Clínicas — **preparado, no activo** (CA-1).
 *
 * El XSD exige en cada renglón `nroQuirofanoSalaOperaciones` (1–9999),
 * `nombreApellidoMedico` y `nitDocumentoMedico`, y la fuente oficial no dice
 * qué corresponde para una consulta ambulatoria. Hasta que un contador o
 * producto lo confirme, el simulador no emite en este sector ni inventa esos
 * valores.
 */
export const HOSPITAL_CLINIC_SCHEMA: SectorDocumentSchema = {
  codigoDocumentoSector: 17,
  nombre: 'Factura de Hospitales/Clínicas',
  raizComputarizada: 'facturaComputarizadaHospitalClinica',
  raizElectronica: 'facturaElectronicaHospitalClinica',
  cabecera: header(17, [field('modalidadServicio', text(0, 100), true)]),
  detalle: [
    field('actividadEconomica', text(1, 10)),
    field('codigoProductoSin', integerType(1, 99_999_999)),
    field('codigoProducto', text(1, 50)),
    field('descripcion', text(1, 500)),
    field('especialidad', text(0, 500), true),
    field('especialidadDetalle', text(0, 500), true),
    field('nroQuirofanoSalaOperaciones', integerType(1, 9999)),
    field('especialidadMedico', text(0, 500), true),
    field('nombreApellidoMedico', text(1, 500)),
    field('nitDocumentoMedico', integerType(1, 9_999_999_999_999)),
    field('nroMatriculaMedico', text(0, 50), true),
    field('nroFacturaMedico', integerType(0, 99_999_999), true),
    field('cantidad', AMOUNT),
    field('unidadMedida', integerType(1, 200)),
    field('precioUnitario', AMOUNT),
    field('montoDescuento', NON_NEGATIVE_AMOUNT, true),
    field('subTotal', AMOUNT),
  ],
  detalleMaximo: 500,
  activo: false,
  motivoInactivo:
    'Sector 17 preparado pero no activo: faltan confirmar quirófano/sala y NIT del médico para consulta ambulatoria (CA-1).',
};

const SCHEMAS: readonly SectorDocumentSchema[] = [PURCHASE_SALE_SCHEMA, HOSPITAL_CLINIC_SCHEMA];

export function sectorSchema(codigoDocumentoSector: number): SectorDocumentSchema | null {
  return SCHEMAS.find((e) => e.codigoDocumentoSector === codigoDocumentoSector) ?? null;
}

export function schemaByRoot(raiz: string): SectorDocumentSchema | null {
  return SCHEMAS.find((e) => e.raizComputarizada === raiz) ?? null;
}
