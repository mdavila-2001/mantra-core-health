import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';
import {
  bloquesDeHistoria,
  bloquesDeOrden,
  historyPdfOptions,
  orderPdfOptions,
  VALOR_ENMASCARADO,
} from './clinical-pdf';
import type { DocumentoDeHistoria, DocumentoDeOrden } from './clinical-pdf.types';
import { historiaDesdeFuentes } from './from-summary';

/**
 * Los dos documentos del carril J3: la **orden** para llevar al laboratorio y la
 * **historia completa** del paciente.
 *
 * Se prueba el contenido y no el PDF por la misma razón que los de al lado: lo
 * que este archivo decide es qué dice el documento, y maquetarlo es de
 * `pdf-export.ts`, que tiene sus propias pruebas.
 *
 * Lo que fijan, y por qué duele si se rompe:
 *
 * 1. **Las cinco secciones de la historia se imprimen siempre, incluso vacías.**
 *    Una sección que desaparece deja a quien lee sin saber si no hubo nada o si
 *    el sistema no lo trajo. En un documento clínico no es lo mismo.
 * 2. **Sin preparación publicada, la orden NO dice «no requiere preparación».**
 *    Dice que el centro no publicó indicaciones. En un ayuno, esa diferencia es
 *    un viaje perdido o un estudio mal hecho.
 * 3. **Cero identificadores internos en el papel.** Es la regla de Melissa, y
 *    en el PDF pesa más: quien lo abre no tiene catálogo con que resolver un
 *    uuid.
 */

/** Todo el texto del documento, para poder buscar campos. */
function textoDe(bloques: readonly { text: string }[]): string {
  return bloques.map((bloque) => bloque.text).join('\n');
}

const ORDEN: DocumentoDeOrden = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  paciente: { nombre: 'Ana Quispe', documento: '1234567 LP' },
  profesional: { nombre: 'Dra. Salas', matricula: 'MP 4821' },
  organizacion: 'Consultorio Central',
  estudio: 'Hemograma completo',
  categoria: 'Laboratorio',
  estado: 'Activa',
  pedidaEl: new Date('2026-08-15T14:00:00.000Z'),
};

const HISTORIA_VACIA: DocumentoDeHistoria = {
  paciente: { nombre: 'Ana Quispe', documento: '1234567 LP' },
  edad: '36 años',
  atenciones: [],
  recetas: [],
  formularios: [],
  ordenes: [],
  resultados: [],
};

describe('bloquesDeOrden', () => {
  it('imprime el estudio, el tipo y cuándo se pidió', () => {
    const texto = textoDe(bloquesDeOrden(ORDEN));

    expect(texto).toContain('Hemograma completo');
    expect(texto).toContain('Laboratorio');
    expect(texto).toContain('Ana Quispe');
    expect(texto).toContain('Dra. Salas');
  });

  it('con preparación publicada, la imprime en su propia sección', () => {
    const texto = textoDe(
      bloquesDeOrden({ ...ORDEN, preparacion: 'Ayuno de 8 horas. Traer carnet.' }),
    );

    expect(texto).toContain('Ayuno de 8 horas. Traer carnet.');
    // Su propia sección: el aviso, con su título.
    expect(
      bloquesDeOrden({ ...ORDEN, preparacion: 'Ayuno de 8 horas. Traer carnet.' }).find(
        (bloque) => bloque.kind === 'note',
      ),
    ).toMatchObject({ title: 'Cómo prepararse', text: 'Ayuno de 8 horas. Traer carnet.' });
  });

  it('sin preparación NO afirma que no haga falta: dice que no hay indicaciones', () => {
    const texto = textoDe(bloquesDeOrden(ORDEN));

    expect(texto).toContain('no publicó indicaciones de preparación');
    expect(texto).not.toContain('No requiere preparación');
    expect(texto).not.toContain('Sin preparación');
  });

  it('una preparación en blanco se trata como ausente, no como texto vacío', () => {
    const texto = textoDe(bloquesDeOrden({ ...ORDEN, preparacion: '   ' }));

    expect(texto).toContain('no publicó indicaciones de preparación');
  });

  it('no imprime el identificador de la orden', () => {
    expect(textoDe(bloquesDeOrden(ORDEN))).not.toContain(ORDEN.id);
  });

  it('no repite en el cuerpo la fecha de generación: la dicen la portada y el pie', () => {
    expect(textoDe(bloquesDeOrden(ORDEN))).not.toContain('generado el');
    expect(orderPdfOptions(ORDEN)).not.toHaveProperty('subtitle');
  });

  it('se emite cuando se pide: la portada lleva esa fecha, el estado y a qué mostrador va', () => {
    const opciones = orderPdfOptions(ORDEN);

    expect(opciones.issuedAt).toEqual(ORDEN.pedidaEl);
    expect(opciones.kind).toBe('Laboratorio');
    expect(opciones.title).toBe('Orden de estudio');
    expect(opciones.meta).toEqual([{ label: 'Estado', value: 'Activa' }]);
    expect(opciones.issuer).toEqual({ name: 'Consultorio Central' });
    // La orden la firma quien la pide: la firma de la sesión no se apaga.
    expect(opciones).not.toHaveProperty('firma');
  });

  it('sin categoría resuelta, la portada no imprime «No registrado» como clase', () => {
    expect(orderPdfOptions({ ...ORDEN, categoria: '' }).kind).toBe('Documento clínico');
    expect(orderPdfOptions({ ...ORDEN, categoria: 'No registrado' }).kind).toBe('Documento clínico');
  });

  it('abre con paciente y profesional en tarjetas, y el estudio en una rejilla', () => {
    const bloques = bloquesDeOrden(ORDEN);

    expect(bloques[0]?.kind).toBe('panels');
    expect(bloques[0]?.panels?.map((tarjeta) => tarjeta.title)).toEqual(['Paciente', 'Profesional']);
    expect(bloques.find((bloque) => bloque.kind === 'fields')?.fields).toEqual([
      { label: 'Estudio', value: 'Hemograma completo' },
      { label: 'Tipo', value: 'Laboratorio' },
    ]);
  });

  it('la preparación es una precondición: va en un aviso de advertencia', () => {
    const conPreparacion = bloquesDeOrden({ ...ORDEN, preparacion: 'Ayuno de 8 horas.' });
    const sinPreparacion = bloquesDeOrden(ORDEN);

    expect(conPreparacion.filter((bloque) => bloque.kind === 'note')).toEqual([
      expect.objectContaining({ tone: 'warning', text: 'Ayuno de 8 horas.' }),
    ]);
    // Sin indicaciones publicadas es información, no una instrucción.
    expect(sinPreparacion.filter((bloque) => bloque.kind === 'note')).toEqual([
      expect.objectContaining({ tone: 'info', title: 'Cómo prepararse' }),
    ]);
  });
});

describe('bloquesDeHistoria', () => {
  it('imprime las cinco secciones aunque no haya nada en ninguna', () => {
    const texto = textoDe(bloquesDeHistoria(HISTORIA_VACIA));

    // Que estén vacías no las borra: sin la sección, quien lee no sabe si no
    // hubo o si el sistema no lo trajo.
    expect(texto).toContain('Atenciones');
    expect(texto).toContain('Recetas');
    expect(texto).toContain('Formularios');
    expect(texto).toContain('Órdenes de estudio');
    expect(texto).toContain('Resultados');
  });

  it('dice con palabras que una sección está vacía', () => {
    const texto = textoDe(bloquesDeHistoria(HISTORIA_VACIA));

    expect(texto).toContain('Sin atenciones registradas.');
    expect(texto).toContain('Sin recetas registradas.');
    expect(texto).toContain('Sin órdenes registradas.');
    expect(texto).toContain('Sin resultados liberados.');
  });

  it('encabeza con los datos de la persona, incluida la edad ya calculada', () => {
    const texto = textoDe(bloquesDeHistoria(HISTORIA_VACIA));

    expect(texto).toContain('Ana Quispe');
    expect(texto).toContain('1234567 LP');
    expect(texto).toContain('36 años');
  });

  it('compone las cuatro fuentes en un solo documento', () => {
    const texto = textoDe(
      bloquesDeHistoria({
        ...HISTORIA_VACIA,
        atenciones: [
          {
            titulo: 'Atención del 14 de agosto de 2026',
            bloques: [
              {
                titulo: 'Diagnósticos',
                datos: [{ etiqueta: 'Principal', valor: 'Faringitis aguda' }],
              },
            ],
          },
        ],
        recetas: [
          {
            id: 'r-1',
            paciente: HISTORIA_VACIA.paciente,
            profesional: { nombre: 'Dra. Salas' },
            creadaEl: new Date('2026-08-14T10:00:00.000Z'),
            medicamentos: [{ medicamento: 'Amoxicilina', dosis: '500 mg' }],
          },
        ],
        ordenes: [ORDEN],
        resultados: [
          { titulo: 'Hemograma', datos: [{ etiqueta: 'Conclusión', valor: 'Valores en rango' }] },
        ],
      }),
    );

    expect(texto).toContain('Faringitis aguda');
    expect(texto).toContain('Amoxicilina');
    expect(texto).toContain('Hemograma completo');
    expect(texto).toContain('Valores en rango');
  });

  it('respeta el enmascarado de un formulario: no imprime el valor protegido', () => {
    const texto = textoDe(
      bloquesDeHistoria({
        ...HISTORIA_VACIA,
        formularios: [
          {
            id: 'f-1',
            titulo: 'Ficha de ingreso',
            respuestas: [
              { etiqueta: 'Antecedentes', texto: 'dato sensible', masked: true },
              { etiqueta: 'Peso', texto: '68 kg', masked: false },
            ],
          },
        ],
      }),
    );

    expect(texto).toContain(VALOR_ENMASCARADO);
    expect(texto).not.toContain('dato sensible');
    expect(texto).toContain('68 kg');
  });

  it('no imprime ningún identificador interno', () => {
    const texto = textoDe(bloquesDeHistoria({ ...HISTORIA_VACIA, ordenes: [ORDEN] }));

    expect(texto).not.toContain(ORDEN.id);
  });

  it('las recetas van en una sola tabla, de la más reciente a la más vieja, y sus indicaciones en otra', () => {
    const receta = {
      id: 'r-1',
      paciente: HISTORIA_VACIA.paciente,
      profesional: { nombre: 'Dra. Salas' },
      creadaEl: new Date(2026, 7, 14, 10, 0),
      emitidaEl: new Date(2026, 7, 14, 10, 5),
      medicamentos: [{ medicamento: 'Amoxicilina', dosis: '500 mg', frecuencia: 'cada 8 horas' }],
      indicaciones: 'Tomar con las comidas.',
    };
    const { emitidaEl: _emitida, indicaciones: _sin, ...borrador } = receta;
    const bloques = bloquesDeHistoria({
      ...HISTORIA_VACIA,
      // La vieja primero en los datos: el papel las ordena por fecha.
      recetas: [receta, { ...borrador, id: 'r-2', creadaEl: new Date(2026, 8, 2, 9, 0), medicamentos: [] }],
    });
    const tabla = bloques.filter((bloque) => bloque.kind === 'row');

    expect(tabla.map((fila) => fila.cells)).toEqual([
      ['Fecha', 'Medicamento', 'Dosis y frecuencia', 'Vigencia', 'Estado'],
      ['02/09/2026', 'Sin medicamentos indicados', '—', '—', 'Sin emitir'],
      ['14/08/2026', 'Amoxicilina', '500 mg · cada 8 horas', '—', 'Emitida'],
      ['Fecha', 'Medicamento', 'Indicaciones'],
      ['14/08/2026', 'Amoxicilina', 'Tomar con las comidas.'],
    ]);
    expect(textoDe(bloques)).toContain('Amoxicilina (14/08/2026): Tomar con las comidas.');
  });

  it('órdenes y atenciones, de la más reciente a la más vieja', () => {
    const bloques = bloquesDeHistoria({
      ...HISTORIA_VACIA,
      ordenes: [ORDEN, { ...ORDEN, id: 'o-2', estudio: 'Glucosa', pedidaEl: new Date(2026, 9, 1) }],
      atenciones: [
        { titulo: 'Sin fecha', bloques: [] },
        { titulo: 'Vieja', inicio: new Date(2026, 0, 5), motivo: 'Control', bloques: [] },
        { titulo: 'Nueva', inicio: new Date(2026, 5, 5), motivo: 'Fiebre', bloques: [] },
      ],
    });
    const textos = bloques.map((bloque) => bloque.text);

    expect(textos.indexOf('Nueva')).toBeLessThan(textos.indexOf('Vieja'));
    expect(textos.indexOf('Vieja')).toBeLessThan(textos.indexOf('Sin fecha'));
    const ordenes = bloques.filter((bloque) => bloque.kind === 'row' && bloque.cells?.length === 4);
    expect(ordenes.map((fila) => fila.cells?.[1])).toEqual(['Estudio', 'Glucosa', 'Hemograma completo']);
  });

  it('las alergias de la persona van en un aviso de alerta, junto a sus datos', () => {
    const bloques = bloquesDeHistoria({ ...HISTORIA_VACIA, alergias: ['Penicilina'] });
    const alergia = bloques.findIndex((bloque) => bloque.kind === 'note');

    expect(bloques[alergia]).toMatchObject({ tone: 'alert', title: 'Alergias registradas' });
    expect(alergia).toBeLessThan(bloques.findIndex((bloque) => bloque.text === 'Atenciones'));
  });

  it('las atenciones son una sola tabla con una banda por atención, vacíos incluidos', () => {
    const tabla = bloquesDeHistoria({
      ...HISTORIA_VACIA,
      atenciones: [
        {
          titulo: 'Atención del 14/08/2026',
          inicio: new Date(2026, 7, 14, 9, 0),
          motivo: 'Dolor de garganta',
          bloques: [
            { titulo: 'Diagnósticos', datos: [{ etiqueta: 'Faringitis aguda', valor: 'Activa' }] },
            { titulo: 'Observaciones', datos: [] },
          ],
        },
        { titulo: 'Atención sin fecha registrada', bloques: [] },
      ],
    }).filter((bloque) => bloque.kind === 'row');

    // Una banda de cabecera por atención —el motor la repite si la tabla sigue
    // en otra hoja— y tres columnas comunes a todas, que así quedan alineadas.
    expect(tabla.map((fila) => [fila.header === true, fila.cells])).toEqual([
      [true, ['14/08/2026', 'Dolor de garganta', '']],
      [false, ['Diagnóstico', 'Faringitis aguda', 'Activa']],
      [false, ['Observación', 'Sin registros', '—']],
      [true, ['', 'Atención sin fecha registrada', '']],
    ]);
    expect(tabla[0]?.text).toBe('Atención del 14/08/2026');
  });

  it('formularios y resultados son tablas con una banda por formulario o resultado', () => {
    const bloques = bloquesDeHistoria({
      ...HISTORIA_VACIA,
      formularios: [
        {
          id: 'f-1',
          titulo: 'Ficha de ingreso',
          completadoEl: new Date(2026, 7, 14, 9, 30),
          respuestas: [{ etiqueta: 'Peso', texto: '68 kg', masked: false }],
        },
        { id: 'f-2', titulo: 'Cuestionario', respuestas: [] },
      ],
      resultados: [{ titulo: 'Hemograma', datos: [{ etiqueta: 'Liberado', valor: '15/08/2026' }] }],
    });
    const tabla = bloques.filter((bloque) => bloque.kind === 'row');

    expect(tabla.map((fila) => [fila.header === true, fila.cells])).toEqual([
      [true, ['Ficha de ingreso', 'Completado el 14/08/2026, 09:30']],
      [false, ['Peso', '68 kg']],
      [true, ['Cuestionario', 'Pendiente de completar']],
      [false, ['Sin respuestas registradas', '—']],
      [true, ['Hemograma', '']],
      [false, ['Liberado', '15/08/2026']],
    ]);
  });

  it('el cuerpo no repite la fecha de generación', () => {
    expect(textoDe(bloquesDeHistoria(HISTORIA_VACIA))).not.toContain('generado el');
  });

  it('es una compilación: sin fecha de emisión inventada y sin bloque de firma', () => {
    const opciones = historyPdfOptions({ ...HISTORIA_VACIA, organizacion: 'Consultorio Central' });

    expect(opciones).not.toHaveProperty('issuedAt');
    expect(opciones.firma).toBeNull();
    expect(opciones.subtitle).toBe('Ana Quispe · 36 años');
    expect(opciones.issuer).toEqual({ name: 'Consultorio Central' });
  });
});

describe('historiaDesdeFuentes con formularios', () => {
  const RESUMEN_VACIO: ClinicalSummary = {
    patientProfileId: 'pp-1',
    conditions: [],
    allergies: [],
    medicationRequests: [],
    observations: [],
    encounters: [],
    careEpisodes: [],
    limit: 50,
    truncated: [],
  };

  it('los formularios que aporta la pantalla llegan al documento, con su enmascarado', () => {
    const historia = historiaDesdeFuentes(
      {
        resumen: RESUMEN_VACIO,
        formularios: [
          {
            id: 'fi-1',
            titulo: 'Formulario clínico',
            completadoEl: new Date('2026-08-17T15:00:00.000Z'),
            respuestas: [
              { etiqueta: 'Tolerancia al ejercicio', texto: 'Buena', masked: false },
              // Aunque el llamador pasara el contenido por error, la bandera manda.
              { etiqueta: 'Serología', texto: 'SECRETO', masked: true },
            ],
          },
        ],
        ordenes: [],
        resultados: [],
      },
      { paciente: 'Ana Quispe', profesional: '' },
      () => 'No registrado',
    );
    const texto = textoDe(bloquesDeHistoria(historia));

    // La respuesta normal aparece, legible.
    expect(texto).toContain('Tolerancia al ejercicio: Buena');
    // La protegida imprime el marcador y jamás el contenido.
    expect(texto).toContain(`Serología: ${VALOR_ENMASCARADO}`);
    expect(texto).not.toContain('SECRETO');
  });

  it('las atenciones van de la más reciente a la más vieja, con su fecha y su motivo', () => {
    const historia = historiaDesdeFuentes(
      {
        resumen: {
          ...RESUMEN_VACIO,
          encounters: [
            { id: 'e-sin', statusConceptId: 's' },
            { id: 'e-1', statusConceptId: 's', startAt: new Date(2026, 0, 5, 9, 0), reasonText: 'Control' },
            { id: 'e-2', statusConceptId: 's', startAt: new Date(2026, 5, 5, 9, 0), reasonText: 'Fiebre' },
          ],
        },
        formularios: [],
        ordenes: [],
        resultados: [],
      },
      { paciente: 'Ana Quispe', profesional: '' },
      () => 'No registrado',
    );

    expect(historia.atenciones.map((atencion) => atencion.titulo)).toEqual([
      'Atención del 05/06/2026',
      'Atención del 05/01/2026',
      'Atención sin fecha registrada',
    ]);
    expect(historia.atenciones[0]).toMatchObject({ motivo: 'Fiebre', inicio: new Date(2026, 5, 5, 9, 0) });
    expect(historia.atenciones[2]).not.toHaveProperty('inicio');
  });

  it('sin formularios, la sección sigue diciendo que no hay', () => {
    const historia = historiaDesdeFuentes(
      { resumen: RESUMEN_VACIO, formularios: [], ordenes: [], resultados: [] },
      { paciente: 'Ana Quispe', profesional: '' },
      () => 'No registrado',
    );

    expect(textoDe(bloquesDeHistoria(historia))).toContain('Sin formularios respondidos.');
  });
});
