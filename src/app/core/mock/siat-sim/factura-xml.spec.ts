import { ESQUEMA_COMPRA_VENTA, ESQUEMA_HOSPITAL_CLINICA, esquemaDeSector, esquemaPorRaiz } from './esquema-siat';
import {
  construirXmlFactura,
  ErrorDeEsquema,
  facturaDesdeXml,
  leerXmlFactura,
  validarFactura,
  type FacturaXml,
} from './factura-xml';

/**
 * `facturaComputarizadaCompraVenta.xml` tal cual viene en el zip oficial del
 * SIN (`CompraVentaXML.zip`, sha256 bd64249d…d99867, descargado el
 * 2026-09-26), incluida la leyenda partida en dos líneas. Si el esquema
 * transcrito se aparta del XSD, este ejemplo deja de validar.
 */
const XML_DE_EJEMPLO_OFICIAL = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<facturaComputarizadaCompraVenta xsi:noNamespaceSchemaLocation="facturaComputarizadaCompraVenta.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <cabecera>
        <nitEmisor>1003579028</nitEmisor>
        <razonSocialEmisor>Carlos Loza</razonSocialEmisor>
        <municipio>La Paz</municipio>
        <telefono>78595684</telefono>
        <numeroFactura>1</numeroFactura>
        <cuf>44AAEC00DBD34C53C3E2CCE1A3FA7AF1E2A08606A667A75AC82F24C74</cuf>
        <cufd>BQUE+QytqQUDBKVUFOSVRPQkxVRFZNVFVJBMDAwMDAwM</cufd>
        <codigoSucursal>0</codigoSucursal>
        <direccion>AV. JORGE LOPEZ #123</direccion>
        <codigoPuntoVenta xsi:nil="true"/>
        <fechaEmision>2021-10-06T16:03:48.675</fechaEmision>
        <nombreRazonSocial>Mi razon social</nombreRazonSocial>
        <codigoTipoDocumentoIdentidad>1</codigoTipoDocumentoIdentidad>
        <numeroDocumento>5115889</numeroDocumento>
        <complemento xsi:nil="true"/>
        <codigoCliente>51158891</codigoCliente>
        <codigoMetodoPago>1</codigoMetodoPago>
        <numeroTarjeta xsi:nil="true"/>
        <montoTotal>99</montoTotal>
        <montoTotalSujetoIva>99</montoTotalSujetoIva>
        <codigoMoneda>1</codigoMoneda>
        <tipoCambio>1</tipoCambio>
        <montoTotalMoneda>99</montoTotalMoneda>
        <montoGiftCard xsi:nil="true"/>
        <descuentoAdicional>1</descuentoAdicional>
        <codigoExcepcion xsi:nil="true"/>
        <cafc xsi:nil="true"/>
        <leyenda>Ley N° 453: Tienes derecho a recibir información sobre las características y contenidos de los
            servicios que utilices.
        </leyenda>
        <usuario>pperez</usuario>
        <codigoDocumentoSector>1</codigoDocumentoSector>
    </cabecera>
    <detalle>
        <actividadEconomica>451010</actividadEconomica>
        <codigoProductoSin>49111</codigoProductoSin>
        <codigoProducto>JN-131231</codigoProducto>
        <descripcion>JUGO DE NARANJA EN VASO</descripcion>
        <cantidad>1</cantidad>
        <unidadMedida>1</unidadMedida>
        <precioUnitario>100</precioUnitario>
        <montoDescuento>0</montoDescuento>
        <subTotal>100</subTotal>
        <numeroSerie>124548</numeroSerie>
        <numeroImei>545454</numeroImei>
    </detalle>
</facturaComputarizadaCompraVenta>`;

/** Orden del XSD oficial de Compra y Venta, copiado del archivo. */
const ORDEN_CABECERA_OFICIAL = [
  'nitEmisor', 'razonSocialEmisor', 'municipio', 'telefono', 'numeroFactura', 'cuf', 'cufd',
  'codigoSucursal', 'direccion', 'codigoPuntoVenta', 'fechaEmision', 'nombreRazonSocial',
  'codigoTipoDocumentoIdentidad', 'numeroDocumento', 'complemento', 'codigoCliente', 'codigoMetodoPago',
  'numeroTarjeta', 'montoTotal', 'montoTotalSujetoIva', 'codigoMoneda', 'tipoCambio', 'montoTotalMoneda',
  'montoGiftCard', 'descuentoAdicional', 'codigoExcepcion', 'cafc', 'leyenda', 'usuario', 'codigoDocumentoSector',
];
const ORDEN_DETALLE_OFICIAL = [
  'actividadEconomica', 'codigoProductoSin', 'codigoProducto', 'descripcion', 'cantidad', 'unidadMedida',
  'precioUnitario', 'montoDescuento', 'subTotal', 'numeroSerie', 'numeroImei',
];

function facturaSintetica(): FacturaXml {
  const leido = leerXmlFactura(XML_DE_EJEMPLO_OFICIAL);
  const { factura } = facturaDesdeXml(ESQUEMA_COMPRA_VENTA, leido);
  return factura;
}

describe('XML de factura · contra el XSD oficial', () => {
  it('el esquema de Compra y Venta tiene el orden exacto del XSD', () => {
    expect(ESQUEMA_COMPRA_VENTA.cabecera.map((c) => c.nombre)).toEqual(ORDEN_CABECERA_OFICIAL);
    expect(ESQUEMA_COMPRA_VENTA.detalle.map((c) => c.nombre)).toEqual(ORDEN_DETALLE_OFICIAL);
  });

  it('el XML de ejemplo oficial se lee y valida sin problemas', () => {
    const leido = leerXmlFactura(XML_DE_EJEMPLO_OFICIAL);
    expect(leido.raiz).toBe('facturaComputarizadaCompraVenta');
    expect(esquemaPorRaiz(leido.raiz)).toBe(ESQUEMA_COMPRA_VENTA);
    const { problemas, factura } = facturaDesdeXml(ESQUEMA_COMPRA_VENTA, leido);
    expect(problemas).toEqual([]);
    expect(factura.cabecera['codigoPuntoVenta']).toBeNull();
    expect(factura.detalle).toHaveLength(1);
  });

  it('construir → leer devuelve los mismos valores y el mismo orden', () => {
    const factura = facturaSintetica();
    const xml = construirXmlFactura(ESQUEMA_COMPRA_VENTA, factura);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')).toBe(true);
    expect(xml).toContain('xsi:noNamespaceSchemaLocation="facturaComputarizadaCompraVenta.xsd"');
    expect(xml).toContain('<codigoPuntoVenta xsi:nil="true"/>');
    const releido = facturaDesdeXml(ESQUEMA_COMPRA_VENTA, leerXmlFactura(xml));
    expect(releido.problemas).toEqual([]);
    expect(releido.factura).toEqual(factura);
  });

  it('escapa los caracteres especiales y los recupera', () => {
    const factura = facturaSintetica();
    const conSimbolos: FacturaXml = {
      ...factura,
      cabecera: { ...factura.cabecera, nombreRazonSocial: 'Pérez & Hijos <SRL> "Ñ"' },
    };
    const xml = construirXmlFactura(ESQUEMA_COMPRA_VENTA, conSimbolos);
    expect(xml).toContain('Pérez &amp; Hijos &lt;SRL&gt; &quot;Ñ&quot;');
    const { factura: releida } = facturaDesdeXml(ESQUEMA_COMPRA_VENTA, leerXmlFactura(xml));
    expect(releida.cabecera['nombreRazonSocial']).toBe('Pérez & Hijos <SRL> "Ñ"');
  });

  it('no construye un XML que no cumple: obligatorio nulo, tipo, rango, longitud, fijo', () => {
    const factura = facturaSintetica();
    const mala: FacturaXml = {
      cabecera: {
        ...factura.cabecera,
        nitEmisor: null,
        numeroFactura: '0',
        municipio: 'x'.repeat(26),
        montoTotal: '99.999',
        codigoDocumentoSector: 17,
      },
      detalle: factura.detalle,
    };
    const rutas = validarFactura(ESQUEMA_COMPRA_VENTA, mala).map((p) => p.ruta);
    expect(rutas).toEqual(
      expect.arrayContaining([
        'cabecera.nitEmisor',
        'cabecera.numeroFactura',
        'cabecera.municipio',
        'cabecera.montoTotal',
        'cabecera.codigoDocumentoSector',
      ]),
    );
    expect(() => construirXmlFactura(ESQUEMA_COMPRA_VENTA, mala)).toThrow(ErrorDeEsquema);
  });

  it('rechaza campos que el XSD no tiene y detalle vacío', () => {
    const factura = facturaSintetica();
    const problemas = validarFactura(ESQUEMA_COMPRA_VENTA, {
      cabecera: { ...factura.cabecera, cuis: 'X' },
      detalle: [],
    });
    expect(problemas).toEqual(
      expect.arrayContaining([
        { ruta: 'cabecera.cuis', problema: 'no existe en el esquema' },
        { ruta: 'detalle', problema: 'tiene que haber al menos un renglón' },
      ]),
    );
  });

  it('detecta un XML con el orden de elementos alterado', () => {
    const alterado = XML_DE_EJEMPLO_OFICIAL.replace(
      '<municipio>La Paz</municipio>\n        <telefono>78595684</telefono>',
      '<telefono>78595684</telefono>\n        <municipio>La Paz</municipio>',
    );
    const { problemas } = facturaDesdeXml(ESQUEMA_COMPRA_VENTA, leerXmlFactura(alterado));
    expect(problemas.some((p) => p.ruta === 'cabecera' && p.problema.includes('orden'))).toBe(true);
  });

  it('el lector rechaza XML mal formado', () => {
    expect(() => leerXmlFactura('<raiz><cabecera><a>1</b></cabecera></raiz>')).toThrow(/XML ilegible/);
    expect(() => leerXmlFactura('<raiz><detalle></detalle></raiz>')).toThrow(/antes de <cabecera>/);
  });

  describe('sector 17 · Hospitales/Clínicas (preparado, no activo · CA-1)', () => {
    it('está transcrito con los campos obligatorios del médico y del quirófano', () => {
      const obligatorios = ESQUEMA_HOSPITAL_CLINICA.detalle.filter((c) => !c.nillable).map((c) => c.nombre);
      expect(obligatorios).toEqual(
        expect.arrayContaining(['nroQuirofanoSalaOperaciones', 'nombreApellidoMedico', 'nitDocumentoMedico']),
      );
      expect(ESQUEMA_HOSPITAL_CLINICA.cabecera.map((c) => c.nombre)).toContain('modalidadServicio');
    });

    it('queda inactivo y con el motivo declarado', () => {
      expect(esquemaDeSector(17)?.activo).toBe(false);
      expect(esquemaDeSector(17)?.motivoInactivo).toMatch(/CA-1/);
      expect(esquemaDeSector(1)?.activo).toBe(true);
    });
  });
});
