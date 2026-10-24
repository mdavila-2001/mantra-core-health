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

  it('declara cuándo y de dónde salió el papel', () => {
    expect(textoDe(bloquesDeOrden(ORDEN))).toContain('Documento generado el');
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

  it('las recetas van en una sola tabla con la fecha delante, y sus indicaciones debajo', () => {
    const receta = {
      id: 'r-1',
      paciente: HISTORIA_VACIA.paciente,
      profesional: { nombre: 'Dra. Salas' },
      creadaEl: new Date(2026, 7, 14, 10, 0),
      emitidaEl: new Date(2026, 7, 14, 10, 5),
      medicamentos: [{ medicamento: 'Amoxicilina', dosis: '500 mg', frecuencia: 'cada 8 horas' }],
      indicaciones: 'Tomar con las comidas.',
    };
    const { emitidaEl: _emitida, ...borrador } = receta;
    const bloques = bloquesDeHistoria({
      ...HISTORIA_VACIA,
      recetas: [receta, { ...borrador, id: 'r-2', medicamentos: [] }],
    });
    const tabla = bloques.filter((bloque) => bloque.kind === 'row');

    expect(tabla.map((fila) => fila.cells)).toEqual([
      ['Fecha', 'Medicamento', 'Dosis y frecuencia', 'Vigencia', 'Estado'],
      ['14/08/2026', 'Amoxicilina', '500 mg · cada 8 horas', '—', 'Emitida'],
      ['14/08/2026', 'Sin medicamentos indicados.', '—', '—', 'Sin emitir'],
    ]);
    expect(textoDe(bloques)).toContain('Amoxicilina (14/08/2026): Tomar con las comidas.');
  });

  it('las alergias de la persona van en un aviso de alerta, junto a sus datos', () => {
    const bloques = bloquesDeHistoria({ ...HISTORIA_VACIA, alergias: ['Penicilina'] });
    const alergia = bloques.findIndex((bloque) => bloque.kind === 'note');

    expect(bloques[alergia]).toMatchObject({ tone: 'alert', title: 'Alergias registradas' });
    expect(alergia).toBeLessThan(bloques.findIndex((bloque) => bloque.text === 'Atenciones'));
  });

  it('cada atención es una tabla con una banda por bloque, vacíos incluidos', () => {
    const tabla = bloquesDeHistoria({
      ...HISTORIA_VACIA,
      atenciones: [
        {
          titulo: 'Atención del 14/08/2026',
          bloques: [
            { titulo: 'Diagnósticos', datos: [{ etiqueta: 'Faringitis aguda', valor: 'Activa' }] },
            { titulo: 'Observaciones', datos: [] },
          ],
        },
      ],
    }).filter((bloque) => bloque.kind === 'row');

    expect(tabla.map((fila) => [fila.header === true, fila.cells])).toEqual([
      [true, ['Diagnósticos', 'Estado clínico']],
      [false, ['Faringitis aguda', 'Activa']],
      [true, ['Observaciones', 'Resultado']],
      [false, ['Sin registros.', '—']],
    ]);
  });

  it('es una compilación: sin fecha de emisión inventada y sin bloque de firma', () => {
    const opciones = historyPdfOptions({ ...HISTORIA_VACIA, organizacion: 'Consultorio Central' });

    expect(opciones).not.toHaveProperty('issuedAt');
    expect(opciones.firma).toBeNull();
    expect(opciones.subtitle).toBe('Ana Quispe · 36 años');
    expect(opciones.issuer).toEqual({ name: 'Consultorio Central' });
  });
});

describe('historiaDesdeFuentes con formularios (cierre del TODO(J3/E1))', () => {
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

  it('sin formularios, la sección sigue diciendo que no hay', () => {
    const historia = historiaDesdeFuentes(
      { resumen: RESUMEN_VACIO, formularios: [], ordenes: [], resultados: [] },
      { paciente: 'Ana Quispe', profesional: '' },
      () => 'No registrado',
    );

    expect(textoDe(bloquesDeHistoria(historia))).toContain('Sin formularios respondidos.');
  });
});
