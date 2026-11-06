import type { Condition } from '../../../../core/data-access/clinical/clinical.types';
import { recorridoDelPaciente } from './episodios';
import { AHORA, codigo, DIAGNOSTICOS, dia, etiqueta, fuentes, ORDENES, resumen } from './mi-recorrido.fixtures';
import { registrosDelPortal } from './registro-con-vinculos';

const armar = (f = fuentes()) => recorridoDelPaciente(registrosDelPortal(f, etiqueta, codigo, AHORA));

describe('registrosDelPortal (adaptador)', () => {
  it('lee replacedByConditionId y reasonConditionId del contrato (los dos vínculos de la franja 1)', () => {
    const registros = registrosDelPortal(fuentes(), etiqueta, codigo, AHORA);
    const migrana = registros.find((r) => r.id === 'c-migrana')!;
    const rm = registros.find((r) => r.id === 'sr-rm')!;
    expect(migrana.estado).toBe('descartado');
    expect(migrana.reemplazadoPorId).toBe('c-tensional');
    expect(rm.diagnosticoId).toBe('c-migrana');
    expect(rm.ausentes).toEqual([]);
  });

  it('marca como ausente el vínculo que no viajó, sin inferirlo', () => {
    const registros = registrosDelPortal(fuentes(), etiqueta, codigo, AHORA);
    const hemograma = registros.find((r) => r.id === 'sr-hem')!;
    expect(hemograma.diagnosticoId).toBeNull();
    expect(hemograma.ausentes).toEqual(['estudio-sin-diagnostico']);

    const sinReemplazo = registrosDelPortal(
      fuentes({
        resumen: resumen({
          conditions: [{ ...DIAGNOSTICOS[0], replacedByConditionId: undefined }],
        }),
      }),
      etiqueta,
      codigo,
      AHORA,
    ).find((r) => r.id === 'c-migrana')!;
    expect(sinReemplazo.reemplazadoPorId).toBeNull();
    expect(sinReemplazo.ausentes).toEqual(['descartado-sin-reemplazo']);
  });

  it('un vínculo a un diagnóstico que no llegó se trata como ausente', () => {
    const registros = registrosDelPortal(
      fuentes({ ordenes: [{ ...ORDENES[0], reasonConditionId: 'c-que-no-vino' }] }),
      etiqueta,
      codigo,
      AHORA,
    );
    expect(registros.find((r) => r.id === 'sr-rm')!.diagnosticoId).toBeNull();
  });

  it('sólo las citas con origen son controles', () => {
    const controles = registrosDelPortal(fuentes(), etiqueta, codigo, AHORA).filter((r) => r.tipo === 'control');
    expect(controles.map((c) => c.id)).toEqual(['bk-control']);
    expect(controles[0].estadoDelControl).toBe('realizado');
    expect(controles[0].origenAtencionId).toBe('e1');
  });
});

describe('recorridoDelPaciente (agrupación)', () => {
  it('une la cadena de reemplazos en un solo hilo con el descartado plegado', () => {
    const { episodios, descartados } = armar();
    expect(episodios).toHaveLength(1);
    const hilo = episodios[0];
    expect(hilo.titulo).toBe('Cefalea tensional');
    expect(hilo.sello).toBe('Confirmado');
    expect(hilo.descartados.map((d) => d.id)).toEqual(['c-migrana']);
    // El descartado no se repite dentro de la atención: va plegado aparte.
    expect(hilo.atenciones[0].hechos.map((h) => h.registro.id)).not.toContain('c-migrana');
    expect(descartados).toEqual([]);
  });

  it('suma al hilo sólo lo vinculado: estudio, receta, control y sus atenciones', () => {
    const hilo = armar().episodios[0];
    expect(hilo.atenciones.map((a) => a.registro.id)).toEqual(['e1', 'e2']);
    const e1 = hilo.atenciones[0].hechos.map((h) => h.registro.id);
    expect(e1).toEqual(expect.arrayContaining(['c-tensional', 'sr-rm', 'bk-control']));
    expect(hilo.atenciones[1].hechos.map((h) => h.registro.id)).toEqual(['rx-1']);
  });

  it('la consulta sin diagnóstico va a «Otras consultas», con su estudio sin vínculo', () => {
    const { otras } = armar();
    expect(otras?.atenciones.map((a) => a.registro.id)).toEqual(['e3']);
    expect(otras?.atenciones[0].hechos.map((h) => h.registro.id)).toEqual(['sr-hem']);
  });

  it('un estudio sin vínculo en una atención del hilo aparece marcado como indirecto', () => {
    const recorrido = armar(
      fuentes({ ordenes: [...ORDENES, { ...ORDENES[1], id: 'sr-suelto', encounterId: 'e1' }] }),
    );
    const hecho = recorrido.episodios[0].atenciones[0].hechos.find((h) => h.registro.id === 'sr-suelto');
    expect(hecho?.directo).toBe(false);
    // Y no entra en la narración del hilo: no se le atribuye a este problema.
    expect(recorrido.episodios[0].pasos.some((p) => p.registroId === 'sr-suelto')).toBe(false);
  });

  it('un hilo que termina en descarte va al grupo de descartados', () => {
    const soloMigrana: Condition = { ...DIAGNOSTICOS[0], replacedByConditionId: undefined };
    const recorrido = armar(fuentes({ resumen: resumen({ conditions: [soloMigrana] }) }));
    expect(recorrido.episodios).toEqual([]);
    expect(recorrido.descartados.map((e) => e.titulo)).toEqual(['Migraña']);
  });

  it('corta un ciclo de reemplazos en vez de colgarse', () => {
    const a: Condition = { ...DIAGNOSTICOS[0], id: 'a', replacedByConditionId: 'b' };
    const b: Condition = { ...DIAGNOSTICOS[0], id: 'b', replacedByConditionId: 'a' };
    const recorrido = armar(fuentes({ resumen: resumen({ conditions: [a, b] }), ordenes: [] }));
    expect(recorrido.descartados.length + recorrido.episodios.length).toBeGreaterThan(0);
  });
});

describe('narración por plantillas', () => {
  it('cuenta el hilo en orden, de usted, y cada frase nombra su registro', () => {
    const pasos = armar().episodios[0].pasos;
    expect(pasos.map((p) => p.texto)).toEqual([
      'El 3 de febrero de 2026 consultó por dolor de cabeza.',
      'Se anotó Migraña como posible diagnóstico.',
      'Se anotó Cefalea tensional como posible diagnóstico.',
      'Le pidieron Resonancia de cráneo por Migraña. El resultado ya está disponible.',
      'El 20 de febrero de 2026 se descartó Migraña; en su lugar quedó Cefalea tensional.',
      'El 20 de febrero de 2026 se confirmó Cefalea tensional con su estudio de Resonancia de cráneo.',
      'El 10 de marzo de 2026 consultó por control de cefalea.',
      'Le recetaron Ibuprofeno 400 mg para Cefalea tensional.',
      'El 10 de marzo de 2026 volvió a control.',
    ]);
    expect(pasos.map((p) => p.registroId)).toEqual([
      'e1',
      'c-migrana',
      'c-tensional',
      'sr-rm',
      'c-migrana',
      'c-tensional',
      'e2',
      'rx-1',
      'bk-control',
    ]);
    // El control se despliega en la atención de la que salió.
    expect(pasos.at(-1)?.atencionId).toBe('e1');
  });

  it('sin fecha, la frase no inventa una', () => {
    const sinFecha = resumen({
      encounters: [{ id: 'e9', statusConceptId: 'x', reasonText: 'Chequeo' }],
      conditions: [],
      medicationRequests: [],
    });
    const otras = armar(fuentes({ resumen: sinFecha, ordenes: [], citas: [] })).otras!;
    expect(otras.pasos[0].texto).toBe('Consultó por chequeo. La atención sigue abierta.');
  });

  it('respeta las siglas del motivo', () => {
    const conSigla = resumen({
      encounters: [{ id: 'e9', statusConceptId: 'x', reasonText: 'ECG de control', startAt: dia('2026-01-05'), endAt: dia('2026-01-05') }],
      conditions: [],
      medicationRequests: [],
    });
    const otras = armar(fuentes({ resumen: conSigla, ordenes: [], citas: [] })).otras!;
    expect(otras.pasos[0].texto).toBe('El 5 de enero de 2026 consultó por ECG de control.');
  });

  it('un descartado no se narra además como resuelto', () => {
    const descartadoYResuelto: Condition = { ...DIAGNOSTICOS[0], resolvedAt: dia('2026-02-20') };
    const pasos = armar(fuentes({ resumen: resumen({ conditions: [descartadoYResuelto, DIAGNOSTICOS[1]] }) })).episodios[0].pasos;
    expect(pasos.some((p) => p.texto.includes('resuelto'))).toBe(false);
  });

  it('un resuelto se narra sin forzar el género del nombre', () => {
    const resuelto: Condition = { ...DIAGNOSTICOS[1], resolvedAt: dia('2026-04-02') };
    const pasos = armar(fuentes({ resumen: resumen({ conditions: [resuelto] }) })).episodios[0].pasos;
    expect(pasos.at(-1)?.texto).toBe('El 2 de abril de 2026 el diagnóstico de Cefalea tensional se dio por resuelto.');
  });

  it('no habla de vos ni de tú', () => {
    const textos = armar().episodios[0].pasos.map((p) => p.texto).join(' ');
    expect(textos).not.toMatch(/\b(tu|tus|te|vos|tenés|consultaste|volviste)\b/i);
  });
});
