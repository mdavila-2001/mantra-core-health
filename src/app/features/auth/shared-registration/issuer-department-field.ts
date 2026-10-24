import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';

/**
 * El campo del departamento que emitió el documento, el mismo en el alta de
 * paciente y en la de médico (antes, un método copiado en cada pantalla).
 *
 * Es un `select` del motor mientras su catálogo esté; si la lectura falló,
 * el mismo campo pasa a `custom` y la pantalla proyecta ahí el aviso con su
 * «Reintentar». Un `select` vacío no tiene dónde decir que no cargó: se ve
 * como un desplegable sin opciones, que es indistinguible de un catálogo que
 * de verdad no tiene ninguna.
 *
 * La clave es la misma en los dos casos —la del control—, así que lo que se
 * haya elegido antes de un fallo no se pierde.
 */
export function campoDepartamentoEmisor(opciones: {
  readonly testId: string;
  readonly catalogoCaido: boolean;
  readonly departamentos: readonly SelectOption<string>[];
  /** Lo que cada pantalla agrega: la explicación larga, el glifo. */
  readonly description?: string;
  readonly icono?: NavIconName;
}): CampoDeFormulario {
  const base = {
    key: 'issuerAdministrativeAreaConceptId',
    label: 'Departamento de emisión',
    required: true,
    hint: 'El «SC», «LP»... de su cédula.',
    ...(opciones.description === undefined ? {} : { description: opciones.description }),
    mensajeDeError: 'Elija el departamento que expidió su cédula.',
  } as const;

  return opciones.catalogoCaido
    ? // Sin catálogo el campo deja de ser un desplegable y pasa a ser un aviso
      // con su botón de reintento: eso no cabe en medio renglón, así que
      // recupera la fila entera. La pareja con el número sólo tiene sentido
      // mientras los dos sean casillas del mismo tamaño.
      { ...base, control: 'custom', ancho: 'completo' }
    : {
        ...base,
        control: 'select',
        options: opciones.departamentos,
        placeholder: 'Elija el departamento',
        testId: opciones.testId,
        ...(opciones.icono === undefined ? {} : { icono: opciones.icono }),
        // La otra mitad del renglón del documento. Ver la página que lo usa.
        ancho: 'mitad',
      };
}
