import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import { describeApiFailure, fieldErrorsOf } from '../../../core/http/api-failure';

/* ============================================================================
    Lo que comparten las pestañas del editor de catálogos: cómo se explica un
    fallo de guardado y cómo se valida un precio antes de molestar al servidor.

    La validación del cliente es una cortesía: el servidor revalida todo y su
    respuesta manda (regla 95.3.2: los errores del servidor se mapean al campo).
    ========================================================================== */

/** Un fallo de guardado, ya repartido en lo que va a un campo y lo que va arriba. */
export interface FalloDeGuardado {
  /** Aviso general (sin campo), o `null` si todo el fallo cayó en campos. */
  readonly general: string | null;
  /** Mensaje por campo del formulario. */
  readonly campos: Readonly<Record<string, string>>;
  /** Otra persona cambió el registro: hay que recargar, no reintentar. */
  readonly conflictoDeVersion: boolean;
}

/** Sub-códigos estables del contrato H3 que se anclan a un campo concreto. */
const CAMPO_POR_MOTIVO: Readonly<Record<string, { campo: string; mensaje: string }>> = {
  SERVICE_CATALOG_CODE_ALREADY_EXISTS: { campo: 'code', mensaje: 'Ya existe un servicio con este código en esa práctica.' },
  SERVICE_CATALOG_PRICE_NOT_POSITIVE: { campo: 'defaultPrice', mensaje: 'El precio debe ser mayor que cero.' },
  GLOSSARY_TERM_ALREADY_EXISTS: { campo: 'slug', mensaje: 'Ya existe un término con este identificador.' },
};

/** La API nombra `text.es`; el formulario tiene un solo campo de texto. */
const ALIAS_DE_CAMPO: Readonly<Record<string, string>> = { 'text.es': 'text', 'text.en': 'text' };

/** Traduce un `HttpErrorResponse` del editor a mensajes para la persona. */
export function fallosDeCatalogo(error: unknown, queSeIntentaba: string): FalloDeGuardado {
  const campos: Record<string, string> = {};
  for (const [campo, mensaje] of Object.entries(fieldErrorsOf(error))) {
    campos[ALIAS_DE_CAMPO[campo] ?? campo] = mensaje;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return { general: queSeIntentaba, campos, conflictoDeVersion: false };
  }
  const cuerpo = readApiError(error);
  const motivo = cuerpo?.reason ?? '';
  const conflictoDeVersion = error.status === 409 && (motivo.endsWith('_VERSION_MISMATCH') || cuerpo?.code === 'CONCURRENCY_CONFLICT');
  const anclado = CAMPO_POR_MOTIVO[motivo];
  if (anclado !== undefined) campos[anclado.campo] = anclado.mensaje;

  if (conflictoDeVersion) {
    return {
      general: 'Otra persona modificó este registro mientras lo editaba. Lo que escribió sigue acá; recargue para ver la versión vigente antes de volver a guardar.',
      campos,
      conflictoDeVersion: true,
    };
  }
  if (Object.keys(campos).length > 0) {
    return { general: 'Revise los campos marcados.', campos, conflictoDeVersion: false };
  }
  if (error.status === 403) {
    return { general: 'Su sesión no tiene permiso para modificar este catálogo. La API lo rechazó; nada cambió.', campos, conflictoDeVersion: false };
  }
  if (error.status === 404) {
    return { general: 'Este registro ya no existe o no pertenece a su organización. Recargue la lista.', campos, conflictoDeVersion: false };
  }
  return { general: describeApiFailure(error, queSeIntentaba), campos, conflictoDeVersion: false };
}

/** Precio de catálogo: decimal con hasta dos decimales, mayor que cero. Devuelve el motivo o `null`. */
export function errorDePrecio(texto: string): string | null {
  const valor = texto.trim();
  if (valor === '') return 'Indique el precio.';
  if (!/^\d+(?:\.\d{1,2})?$/.test(valor)) return 'Use un número con punto y hasta dos decimales, por ejemplo 150.00.';
  if (!/[1-9]/.test(valor)) return 'El precio debe ser mayor que cero.';
  return null;
}

/** Identificador de término: kebab-case en minúsculas, hasta 80 caracteres. */
export function errorDeIdentificador(texto: string): string | null {
  const valor = texto.trim();
  if (valor === '') return 'Indique el identificador.';
  if (valor.length > 80) return 'Use 80 caracteres como máximo.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valor)) return 'Solo minúsculas, números y guiones medios, por ejemplo «presion-arterial».';
  return null;
}

/** Texto obligatorio con tope. */
export function errorDeTexto(texto: string, rotulo: string, maximo: number): string | null {
  const valor = texto.trim();
  if (valor === '') return `Indique ${rotulo}.`;
  if (valor.length > maximo) return `Use ${maximo} caracteres como máximo.`;
  return null;
}

/** Fecha corta para la columna «Actualizado». Un texto no fechable se muestra tal cual. */
export function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? iso
    : fecha.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/La_Paz' });
}

/** Nombre en español de cada tipo de organización (conceptos `PR_TYPE_*` de la API). */
const ROTULO_DE_TIPO: Readonly<Record<string, string>> = {
  PR_TYPE_CLINIC: 'Clínica',
  PR_TYPE_HOSPITAL: 'Hospital',
  PR_TYPE_OFFICE: 'Consultorio',
  PR_TYPE_MED_CENTER: 'Centro médico',
  PR_TYPE_LAB: 'Laboratorio',
  PR_TYPE_DIAG_CENTER: 'Centro de diagnóstico',
  PR_TYPE_UNIVERSITY: 'Universidad',
  PR_TYPE_FOUNDATION: 'Fundación',
  PR_TYPE_INSURER: 'Aseguradora',
  PR_TYPE_PHARMACY: 'Farmacia',
};

/** El tipo con nombre de persona; un código que no se conoce se muestra con el texto de la API, sin inventar. */
export function rotuloDeTipoDeOrganizacion(code: string, display: string): string {
  return ROTULO_DE_TIPO[code] ?? display;
}
