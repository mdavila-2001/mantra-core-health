/* ============================================================================
    El alta pública de Alianza Seguros (`/auth/register/organization`), tal
    como la escribe la persona en el video.

    Todo es ficticio: el NIT, las personas, los CI, los celulares y los PDF.
    Los correos usan `mail.com`, como el resto del video.

    Tres valores tienen que coincidir con lo que después muestra «Mi perfil»,
    así que `grabar.mjs` reescribe la cuenta de prueba con ellos (ver
    `ASEGURADORA`): razón social, NIT, sigla y dirección. El representante legal,
    que es quien inicia sesión, se registra como `aseguradora@…` porque el simulador resuelve el login por la parte
    local del correo (`buscarUsuario`, mock-session.ts): es lo que hace que la
    cuenta «recién creada» pueda entrar.
    ========================================================================== */

import { ASEGURADORA } from './datos-alianza.mjs';

/** Un NIT ficticio: nueve a diez dígitos, como los de la región. */
export const NIT = '1020347028';

export const ALTA = {
  razonSocial: ASEGURADORA.razonSocial,
  sigla: ASEGURADORA.sigla,
  /** El texto de la opción del desplegable «Tipo societario». */
  tipoSocietario: /Sociedad An[oó]nima/i,
  nit: NIT,
  direccion: ASEGURADORA.direccion,
  nombreComercial: ASEGURADORA.nombre,
  representante: {
    nombre: 'Rodrigo',
    apellidoPaterno: 'Salvatierra',
    apellidoMaterno: 'Peña',
    ci: '4872190 LP',
    /**
     * El representante legal es el único que inicia sesión por la aseguradora
     * (es el owner de la cuenta): este correo y esta contraseña son los del
     * login. Ver el encabezado: el login simulado resuelve `aseguradora@…`.
     */
    correo: 'aseguradora@mail.com',
    contrasena: 'Alianza2026!',
    celular: '71234567',
  },
  gerencias: {
    'general-manager': { nombre: 'Andrés', apellido: 'Villarroel', apellidoMaterno: 'Soto', celular: '72345678', correo: 'gerencia.general@mail.com' },
    'commercial-manager': { nombre: 'Claudia', apellido: 'Mendieta', apellidoMaterno: 'Ríos', celular: '73456789', correo: 'gerencia.comercial@mail.com' },
    'marketing-manager': { nombre: 'Fernando', apellido: 'Terán', apellidoMaterno: 'Vaca', celular: '74567890', correo: 'gerencia.marketing@mail.com' },
  },
};

/**
 * Los seis PDF del alta, en el orden en que los pide la pantalla. El título es
 * el rótulo que la pantalla le da a cada zona (Bolivia); `kb` es el tamaño
 * aproximado, para que la pantalla muestre un peso creíble y no 700 bytes.
 */
export const DOCUMENTOS = [
  { clave: 'constitutionFileId', archivo: 'Escritura-de-constitucion-Alianza.pdf', titulo: 'Escritura de constitución', kb: 412 },
  { clave: 'taxIdentifierFileId', archivo: 'Certificado-NIT-Alianza.pdf', titulo: 'Certificado de NIT', kb: 96 },
  { clave: 'commerceRegistryFileId', archivo: 'Matricula-SEPREC-Alianza.pdf', titulo: 'Matrícula de comercio (SEPREC)', kb: 228 },
  { clave: 'operatingLicenseFileId', archivo: 'Licencia-funcionamiento-municipal-Alianza.pdf', titulo: 'Licencia de funcionamiento municipal', kb: 143 },
  { clave: 'healthAuthorityCertificateFileId', archivo: 'Certificado-SEDES-Alianza.pdf', titulo: 'Certificado del SEDES', kb: 187 },
  { clave: 'powerOfAttorneyFileId', archivo: 'Poder-representante-legal-Alianza.pdf', titulo: 'Poder del representante legal', kb: 276 },
];

/**
 * Un PDF válido de una página, armado a mano: cabecera, objetos, tabla
 * de referencias cruzadas con los desplazamientos reales y `%%EOF`. Dice que
 * es un documento de ejemplo, para que nadie lo confunda con uno verdadero.
 */
export function pdfDeEjemplo(titulo, kb = 0) {
  const limpio = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()\\]/g, '');
  const lineas = [limpio(titulo), limpio(ASEGURADORA.razonSocial), 'DOCUMENTO DE EJEMPLO - dato ficticio'];
  const texto = lineas
    .map((l, i) => `BT /F1 ${i === 0 ? 20 : 13} Tf 72 ${720 - i * 34} Td (${l}) Tj ET`)
    .join('\n');
  const relleno = kb > 0 ? '% documento de ejemplo\n'.repeat(Math.ceil((kb * 1024) / 22)) : '';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    // Un objeto sin referencias que sólo da peso: el PDF sigue siendo válido.
    `<< /Length ${relleno.length} >>\nstream\n${relleno}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const desplazamientos = [];
  objetos.forEach((cuerpo, i) => {
    desplazamientos.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const d of desplazamientos) pdf += `${String(d).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
