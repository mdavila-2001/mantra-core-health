import { conceptById, SPECIALTY, MUNICIPALITY, OBSERVATION, OCCUPATION } from '../fixtures/concepts';
import { MEDICAL, PACIENTE, PATIENTS, PROFESSIONALS, PROFESSIONALS_REGISTERED_DEMO } from '../fixtures/people';
import { IDS } from '../mock-session';

import * as fk from './index';

/* ============================================================================
    Lo que el generador tiene que cumplir sí o sí.

    No se comprueba «que los datos parezcan reales» —eso se ve mirando—, sino
    las tres propiedades de las que depende el resto del mock y que se pierden
    en silencio: el determinismo, la validez de los códigos y la estabilidad de
    las personas escritas a mano.
    ========================================================================== */

describe('faker del backend simulado', () => {
  describe('determinismo', () => {
    it('la misma semilla da exactamente lo mismo, dos veces seguidas', () => {
      const primera = fk.conSemilla('prueba-1');
      const uno = [primera.person.firstName('female'), fk.apellido(primera), fk.celular(primera)];

      const segunda = fk.conSemilla('prueba-1');
      const dos = [segunda.person.firstName('female'), fk.apellido(segunda), fk.celular(segunda)];

      expect(dos).toEqual(uno);
    });

    it('no depende del orden: sembrar otra cosa en medio no cambia el resultado', () => {
      const a = fk.conSemilla('persona-A');
      const esperado = a.person.firstName('male');

      fk.conSemilla('persona-B').person.firstName('female');

      const otraVez = fk.conSemilla('persona-A');
      expect(otraVez.person.firstName('male')).toBe(esperado);
    });

    it('semillas distintas dan personas distintas', () => {
      const nombres = new Set(
        Array.from({ length: 40 }, (_, i) => {
          const f = fk.conSemilla(`variedad-${i}`);
          return `${f.person.firstName()} ${fk.apellido(f)}`;
        }),
      );
      // Alguna coincidencia es normal en 40 tiradas; un generador atascado
      // devolvería una sola.
      expect(nombres.size).toBeGreaterThan(30);
    });
  });

  describe('los códigos salen del catálogo, nunca inventados', () => {
    it('cada especialidad de cada profesional existe en la terminología', () => {
      const validos = new Set(Object.values(SPECIALTY));
      const invalidas = PROFESSIONALS.flatMap((p) =>
        p.especialidades.filter((id) => !validos.has(id)).map((id) => `${p.displayName}: ${id}`),
      );
      expect(invalidas).toEqual([]);
    });

    it('cada ocupación y cada municipio de cada paciente existen', () => {
      const ocupaciones = new Set(Object.values(OCCUPATION));
      const municipios = new Set(Object.values(MUNICIPALITY));
      // Vacío es «la planilla no lo declara» (personas de USUARIO_PACIENTES):
      // no es un código inventado. Lo que sí viaja tiene que existir.
      const malos = PATIENTS.filter(
        (p) =>
          (p.ocupacionId !== '' && !ocupaciones.has(p.ocupacionId)) ||
          (p.municipioId !== '' && !municipios.has(p.municipioId)),
      ).map((p) => p.displayName);
      expect(malos).toEqual([]);
    });

    it('los conceptos clínicos que genera se resuelven', () => {
      const f = fk.conSemilla('clinico');
      for (let i = 0; i < 25; i++) {
        expect(conceptById(fk.diagnosticoId(f))).toBeDefined();
        expect(conceptById(fk.medicamentoId(f))).toBeDefined();
        expect(conceptById(fk.viaId(f))).toBeDefined();
        expect(conceptById(fk.unidadId(f))).toBeDefined();
      }
    });
  });

  describe('las personas escritas a mano no se mueven', () => {
    it('la médica y la paciente con las que se entra conservan sus identificadores', () => {
      expect(MEDICAL.id).toBe(IDS.medica.practitionerProfileId);
      expect(MEDICAL.slug).toBe('valeria-rojas');
      expect(PACIENTE.id).toBe(IDS.paciente.patientProfileId);
    });

    it('los índices que otros fixtures usan siguen apuntando a los mismos', () => {
      // `agenda.ts` usa PROFESIONALES[6] y .slice(1, 5); `clinic.ts`, los
      // primeros seis. Si el generador se colara delante, las agendas y las
      // recetas cambiarían de dueño sin que nada fallara.
      expect(PROFESSIONALS[6]!.slug).toBe('daniel-aguilar');
      expect(PROFESSIONALS.slice(1, 5).map((p) => p.slug)).toEqual([
        'jorge-salazar',
        'maria-quiroga',
        'rodrigo-paz',
        'luis-camacho',
      ]);
    });
  });

  describe('el padrón generado', () => {
    it('tiene volumen suficiente para que haya que paginar', () => {
      // Los quince escritos a mano, los 763 médicos reales de la red de
      // Alianza Seguros y Nacional Seguros (`insurer-network.ts`) y los 13 de
      // USUARIO_MEDICOS; 120 pacientes de la maqueta más los 92 de
      // USUARIO_PACIENTES (`registered-people.ts`). Y, desde D-H3-PROV-01
      // (23/09/2026), los 13 profesionales de demostración con agenda simulada.
      expect(PROFESSIONALS_REGISTERED_DEMO.length).toBe(13);
      expect(PROFESSIONALS.length).toBe(15 + 763 + 13 + PROFESSIONALS_REGISTERED_DEMO.length);
      expect(PATIENTS.length).toBe(120 + 92);
    });

    it('no repite identificadores ni slugs', () => {
      const ids = PROFESSIONALS.map((p) => p.id).concat(PATIENTS.map((p) => p.id));
      expect(new Set(ids).size).toBe(ids.length);

      const slugs = PROFESSIONALS.map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('reparte edades, ciudades y coberturas en vez de clonar una sola persona', () => {
      // Sólo los generados: los reales viajan sin fecha de nacimiento.
      const edades = PATIENTS.filter((p) => p.origen === undefined).map((p) => fk.edadDe(p.birthDate));
      expect(Math.min(...edades)).toBeLessThan(12);
      expect(Math.max(...edades)).toBeGreaterThan(70);

      expect(new Set(PATIENTS.map((p) => p.municipioId)).size).toBeGreaterThan(3);
      expect(PATIENTS.filter((p) => p.aseguradora !== undefined).length).toBeGreaterThan(20);
      expect(new Set(PROFESSIONALS.map((p) => p.professionalTitle)).size).toBeGreaterThan(10);
    });

    it('los teléfonos y las cédulas tienen forma boliviana', () => {
      // Los generados. Los de USUARIO_PACIENTES no traen celular ni cédula:
      // son personas reales y el repositorio es público.
      const malos = PATIENTS.filter((p) => p.origen === undefined).filter(
        (p) => !/^\+591 [67]\d{7}$/.test(p.phone) || !/^\d{7}$/.test(p.nationalId),
      ).map((p) => `${p.displayName}: ${p.phone} · ${p.nationalId}`);
      expect(malos).toEqual([]);
    });
  });

  describe('los signos vitales son plausibles para la edad', () => {
    it('un lactante no pesa lo que un adulto', () => {
      const f = fk.conSemilla('vitales-bebe');
      const peso = fk.signosVitales(f, 1).find((s) => s.observationConceptId === OBSERVATION['OBS-WEIGHT'])!;
      expect(Number(peso.value)).toBeLessThan(20);

      const adulto = fk.conSemilla('vitales-adulto');
      const pesoAdulto = fk
        .signosVitales(adulto, 40)
        .find((s) => s.observationConceptId === OBSERVATION['OBS-WEIGHT'])!;
      expect(Number(pesoAdulto.value)).toBeGreaterThan(45);
    });

    it('ningún valor se va de rango fisiológico en cien tiradas', () => {
      const fuera: string[] = [];
      for (let i = 0; i < 100; i++) {
        const f = fk.conSemilla(`vitales-${i}`);
        const edad = i % 90;
        for (const signo of fk.signosVitales(f, edad)) {
          const valor = Number(signo.value);
          if (!Number.isFinite(valor) || valor <= 0 || valor > 200) {
            fuera.push(`edad ${edad}: ${signo.value}`);
          }
        }
      }
      expect(fuera).toEqual([]);
    });
  });
});
