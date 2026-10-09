/* ============================================================================
    El XML de la factura: construirlo, leerlo y validarlo contra el esquema.

    La forma copia el XML de ejemplo oficial del SIN (`CompraVentaXML.zip`,
    `facturaComputarizadaCompraVenta.xml`): declaración `standalone="yes"`,
    raíz con `xsi:noNamespaceSchemaLocation`, `cabecera` y uno o más `detalle`,
    y los campos vacíos como `<campo xsi:nil="true"/>`.

    El lector está hecho a medida de esa forma —raíz, bloques planos, texto sin
    atributos— y no es un parser XML general. Existe para que el simulador no
    dependa de `DOMParser`: el mismo código tiene que poder mudarse a la API,
    que corre en Node.
    ========================================================================== */

import type { CampoXsd, EsquemaDocumentoSector } from './siat-schema';

export type ValorXml = string | number | null;
export type FilaXml = Readonly<Record<string, ValorXml>>;

export interface FacturaXml {
  readonly cabecera: FilaXml;
  readonly detalle: readonly FilaXml[];
}

export interface ProblemaDeEsquema {
  /** `cabecera.montoTotal`, `detalle[2].subTotal`. */
  readonly ruta: string;
  readonly problema: string;
}

export class ErrorDeEsquema extends Error {
  constructor(readonly problemas: readonly ProblemaDeEsquema[]) {
    super(`La factura no cumple el esquema: ${problemas.map((p) => `${p.ruta} ${p.problema}`).join('; ')}`);
    this.name = 'ErrorDeEsquema';
  }
}

export class ErrorDeLecturaXml extends Error {
  constructor(motivo: string) {
    super(`XML ilegible: ${motivo}`);
    this.name = 'ErrorDeLecturaXml';
  }
}

const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const DECLARACION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const INDENTACION = '    ';

// ---- validación ------------------------------------------------------------

const ENTERO = /^-?\d+$/;
/** `fractionDigits=2`, `totalDigits=17`. */
const DECIMAL = /^-?\d+(\.\d{1,2})?$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function problemaDeValor(campo: CampoXsd, valor: string): string | null {
  if (campo.fijo !== undefined && valor !== campo.fijo) {
    return `tiene que ser ${campo.fijo}`;
  }
  switch (campo.tipo) {
    case 'integer': {
      if (!ENTERO.test(valor)) return 'no es un entero';
      const n = BigInt(valor);
      if (campo.min !== undefined && n < BigInt(campo.min)) return `menor que ${campo.min}`;
      if (campo.max !== undefined && n > BigInt(campo.max)) return `mayor que ${campo.max}`;
      return null;
    }
    case 'decimal': {
      if (!DECIMAL.test(valor)) return 'no es un decimal con hasta 2 decimales';
      if (valor.replace(/[-.]/g, '').length > 17) return 'excede 17 dígitos';
      if (campo.min !== undefined && Number(valor) < Number(campo.min)) return `menor que ${campo.min}`;
      return null;
    }
    case 'dateTime':
      return FECHA_HORA.test(valor) ? null : 'no es una fecha y hora xs:dateTime';
    case 'string': {
      const largo = [...valor].length;
      if (campo.minLength !== undefined && largo < campo.minLength) return `más corto que ${campo.minLength}`;
      if (campo.maxLength !== undefined && largo > campo.maxLength) return `más largo que ${campo.maxLength}`;
      return null;
    }
  }
}

function validarFila(campos: readonly CampoXsd[], fila: FilaXml, prefijo: string): ProblemaDeEsquema[] {
  const problemas: ProblemaDeEsquema[] = [];
  const conocidos = new Set(campos.map((c) => c.nombre));
  for (const clave of Object.keys(fila)) {
    if (!conocidos.has(clave)) problemas.push({ ruta: `${prefijo}.${clave}`, problema: 'no existe en el esquema' });
  }
  for (const campo of campos) {
    const ruta = `${prefijo}.${campo.nombre}`;
    if (!(campo.nombre in fila)) {
      problemas.push({ ruta, problema: 'falta' });
      continue;
    }
    const valor = fila[campo.nombre];
    if (valor === null || valor === undefined) {
      if (!campo.nillable) problemas.push({ ruta, problema: 'es obligatorio' });
      continue;
    }
    const problema = problemaDeValor(campo, String(valor));
    if (problema !== null) problemas.push({ ruta, problema });
  }
  return problemas;
}

/** Todo lo que el esquema declara y la factura no cumple. Vacío = válida. */
export function validarFactura(esquema: EsquemaDocumentoSector, factura: FacturaXml): ProblemaDeEsquema[] {
  const problemas = validarFila(esquema.cabecera, factura.cabecera, 'cabecera');
  if (factura.detalle.length < 1) problemas.push({ ruta: 'detalle', problema: 'tiene que haber al menos un renglón' });
  if (factura.detalle.length > esquema.detalleMaximo) {
    problemas.push({ ruta: 'detalle', problema: `excede ${esquema.detalleMaximo} renglones` });
  }
  factura.detalle.forEach((fila, i) => problemas.push(...validarFila(esquema.detalle, fila, `detalle[${i}]`)));
  return problemas;
}

// ---- construcción ----------------------------------------------------------

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function bloque(nombre: string, campos: readonly CampoXsd[], fila: FilaXml): string {
  const lineas = campos.map((campo) => {
    const valor = fila[campo.nombre];
    return valor === null || valor === undefined
      ? `${INDENTACION}${INDENTACION}<${campo.nombre} xsi:nil="true"/>`
      : `${INDENTACION}${INDENTACION}<${campo.nombre}>${escapar(String(valor))}</${campo.nombre}>`;
  });
  return [`${INDENTACION}<${nombre}>`, ...lineas, `${INDENTACION}</${nombre}>`].join('\n');
}

/**
 * El XML Computarizado en Línea de la factura, en el orden del XSD. Lanza
 * {@link ErrorDeEsquema} si algo no cumple: un XML inválido no sale de acá.
 */
export function construirXmlFactura(esquema: EsquemaDocumentoSector, factura: FacturaXml): string {
  const problemas = validarFactura(esquema, factura);
  if (problemas.length > 0) throw new ErrorDeEsquema(problemas);
  const raiz = esquema.raizComputarizada;
  return [
    DECLARACION,
    `<${raiz} xsi:noNamespaceSchemaLocation="${raiz}.xsd" xmlns:xsi="${XSI}">`,
    bloque('cabecera', esquema.cabecera, factura.cabecera),
    ...factura.detalle.map((fila) => bloque('detalle', esquema.detalle, fila)),
    `</${raiz}>`,
  ].join('\n');
}

// ---- lectura ---------------------------------------------------------------

export interface CampoLeido {
  readonly nombre: string;
  readonly valor: string | null;
}

export interface XmlLeido {
  readonly raiz: string;
  readonly cabecera: readonly CampoLeido[];
  readonly detalle: readonly (readonly CampoLeido[])[];
}

function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const CAMPO = /\s*(?:<(\w+)\s+xsi:nil="true"\s*\/>|<(\w+)>([^<]*)<\/\2>)/y;

function leerCampos(contenido: string, bloqueNombre: string): CampoLeido[] {
  const campos: CampoLeido[] = [];
  CAMPO.lastIndex = 0;
  while (CAMPO.lastIndex < contenido.length) {
    if (/^\s*$/.test(contenido.slice(CAMPO.lastIndex))) break;
    const inicio = CAMPO.lastIndex;
    const m = CAMPO.exec(contenido);
    if (m === null) throw new ErrorDeLecturaXml(`contenido inesperado en <${bloqueNombre}> (posición ${inicio})`);
    campos.push(m[1] !== undefined ? { nombre: m[1], valor: null } : { nombre: m[2]!, valor: desescapar(m[3]!) });
  }
  return campos;
}

const BLOQUE = /\s*<(cabecera|detalle)>([\s\S]*?)<\/\1>/y;

/** Lee un XML con la forma que produce {@link construirXmlFactura}. */
export function leerXmlFactura(xml: string): XmlLeido {
  // El BOM se reconoce por su código, no escrito: un carácter invisible en la fuente
  // es exactamente lo que `no-irregular-whitespace` existe para impedir.
  const sinBom = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const sinDeclaracion = sinBom.replace(/^\s*<\?xml[^?]*\?>/, '');
  const raiz = /^\s*<(\w+)(?:\s[^>]*)?>([\s\S]*)<\/\1>\s*$/.exec(sinDeclaracion);
  if (raiz === null) throw new ErrorDeLecturaXml('no hay un elemento raíz cerrado');
  const cuerpo = raiz[2]!;
  let cabecera: CampoLeido[] | null = null;
  const detalle: CampoLeido[][] = [];
  BLOQUE.lastIndex = 0;
  while (BLOQUE.lastIndex < cuerpo.length) {
    if (/^\s*$/.test(cuerpo.slice(BLOQUE.lastIndex))) break;
    const m = BLOQUE.exec(cuerpo);
    if (m === null) throw new ErrorDeLecturaXml('se esperaba <cabecera> o <detalle>');
    if (m[1] === 'cabecera') {
      if (cabecera !== null || detalle.length > 0) throw new ErrorDeLecturaXml('<cabecera> fuera de lugar');
      cabecera = leerCampos(m[2]!, 'cabecera');
    } else {
      if (cabecera === null) throw new ErrorDeLecturaXml('<detalle> antes de <cabecera>');
      detalle.push(leerCampos(m[2]!, 'detalle'));
    }
  }
  if (cabecera === null) throw new ErrorDeLecturaXml('falta <cabecera>');
  return { raiz: raiz[1]!, cabecera, detalle };
}

function filaDe(campos: readonly CampoLeido[]): FilaXml {
  return Object.fromEntries(campos.map((c) => [c.nombre, c.valor]));
}

function problemasDeOrden(esperado: readonly CampoXsd[], leidos: readonly CampoLeido[], prefijo: string): ProblemaDeEsquema[] {
  const nombres = leidos.map((c) => c.nombre);
  const esperados = esperado.map((c) => c.nombre);
  if (nombres.join('|') === esperados.join('|')) return [];
  const primero = esperados.findIndex((nombre, i) => nombres[i] !== nombre);
  return [
    {
      ruta: prefijo,
      problema: `orden de elementos distinto al del XSD desde «${esperados[primero] ?? nombres[primero] ?? '?'}»`,
    },
  ];
}

/**
 * La factura leída, con los problemas de orden (el XSD usa `xs:sequence`) y
 * de contenido contra el esquema.
 */
export function facturaDesdeXml(
  esquema: EsquemaDocumentoSector,
  leido: XmlLeido,
): { readonly factura: FacturaXml; readonly problemas: readonly ProblemaDeEsquema[] } {
  const factura: FacturaXml = { cabecera: filaDe(leido.cabecera), detalle: leido.detalle.map(filaDe) };
  const problemas = [
    ...problemasDeOrden(esquema.cabecera, leido.cabecera, 'cabecera'),
    ...leido.detalle.flatMap((fila, i) => problemasDeOrden(esquema.detalle, fila, `detalle[${i}]`)),
    ...validarFactura(esquema, factura),
  ];
  return { factura, problemas };
}
