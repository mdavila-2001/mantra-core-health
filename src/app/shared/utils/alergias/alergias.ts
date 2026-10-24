/**
 * Los códigos CIE-10 (OMS) que dicen «esta persona es alérgica»: Z88
 * (antecedente de alergia a fármacos), Z91.0 (a otras sustancias), T78.0–T78.4
 * (anafilaxia, edema angioneurótico, alergia no especificada) y T88.6
 * (anafilaxia por fármaco bien administrado).
 *
 * Desde el 02/10/2026 una alergia se carga como diagnóstico (pedido del
 * cliente): es el código del catálogo, y no el texto, lo que dice que un
 * diagnóstico es una alergia. Deducirlo de un nombre sería adivinar.
 */
const CODIGO_CIE10_DE_ALERGIA = /^(Z88|Z91\.0|T78\.[0-4]|T88\.6)/;

/** Si el código CIE-10 de un diagnóstico es de alergia. */
export function esCodigoDeAlergia(codigo: string | undefined): boolean {
  return codigo !== undefined && CODIGO_CIE10_DE_ALERGIA.test(codigo);
}
