import { HttpHeaders } from '@angular/common/http';

import { registrarVarios } from '../handlers/misc.handlers';
import { MockRouter } from '../mock-router';
import { conceptByCode, membersOf } from './concepts';
import { MEDICAMENTOS_LINAME } from './liname.generated';

describe('vademécum de la receta: la LINAME 2022-2024', () => {
  it('trae los medicamentos esenciales de Bolivia además de los 15 de demostración', () => {
    const vademecum = membersOf('VS_MEDICATION');
    expect(MEDICAMENTOS_LINAME.length).toBeGreaterThan(480);
    expect(vademecum.length).toBeGreaterThan(480);
    // Ningún ATC aparece dos veces: los de demostración absorben su presentación LINAME.
    const codigos = vademecum.map((c) => c.code);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('un medicamento de la LINAME llega con su nombre oficial, formas, concentraciones y código LINAME', () => {
    const gentamicina = conceptByCode('J01GB03');
    expect(gentamicina?.display).toBe('Gentamicina sulfato');
    expect(gentamicina?.properties?.['dose_forms']).toEqual(['Inyectable']);
    expect(gentamicina?.properties?.['strengths']).toEqual(
      expect.arrayContaining(['20 mg', '80 mg']),
    );
    expect(gentamicina?.properties?.['liname_presentations']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'J-01-49', form: 'Inyectable', strength: '80 mg' }),
      ]),
    );
  });

  it('los de demostración conservan su código y toman las formas de la LINAME', () => {
    const amoxicilina = conceptByCode('MED-AMOXICILINA');
    // La LINAME publica la amoxicilina en comprimido, inyectable y suspensión
    // (J-01-05, J-01-06, J-01-08, J-01-57): todas bajo J01CA04 tras corregir la
    // numeración propia de la LINAME (J01CA05/06/07 no son amoxicilina en la OMS).
    expect(amoxicilina?.properties?.['dose_forms']).toEqual([
      'Comprimido',
      'Inyectable',
      'Suspensión',
    ]);
    expect(conceptByCode('J01CA05')).toBeUndefined();
    expect(conceptByCode('J01CA04')).toBeUndefined();
  });

  it('no quedan acentos graves de la fuente («sòdica»)', () => {
    expect(MEDICAMENTOS_LINAME.filter((m) => /[àèìòù]/i.test(m.name))).toEqual([]);
  });

  it('el buscador de la receta recibe el vademécum, no los estados de registro', () => {
    // El catálogo que pide `medication-block` no estaba mapeado y caía al
    // `VS_RECORD_STATUS` de respaldo: ninguna búsqueda encontraba un medicamento.
    const router = new MockRouter();
    registrarVarios(router);
    const target = 'clinical.medication_requests.medication_concept_id';
    const match = router.match('GET', '/system-context/dynamic-enums')!;
    const enumeracion = match.handler({
      method: 'GET',
      path: '/system-context/dynamic-enums',
      params: match.params,
      query: new URLSearchParams({ target }),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    }) as { name: string; options: readonly { code: string; display: string }[] };
    expect(enumeracion.name).toBe('Medicamento');
    expect(enumeracion.options.length).toBeGreaterThan(480);
    expect(enumeracion.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'J01GB03', display: 'Gentamicina sulfato' }),
      ]),
    );
  });
});
