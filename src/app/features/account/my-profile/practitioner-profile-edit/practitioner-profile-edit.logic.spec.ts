import {
  UNIVERSIDADES_DEL_SISTEMA,
  UNIVERSIDADES_PRIVADAS,
} from '../../../../core/profesion/instituciones-educativas';
import {
  codigoDeInstitucion,
  coincideConElConcepto,
  coincideConElEstado,
  coincideConLaBusqueda,
  estadosPresentes,
  filasDeLaPagina,
  institucionConCodigo,
  matriculaPendiente,
  normalizarParaBuscar,
  OPCIONES_DE_INSTITUCION_CON_SIGLA,
} from './practitioner-profile-edit.logic';

describe('practitioner-profile-edit.logic', () => {
  describe('normalizarParaBuscar', () => {
    it('quita tildes, mayúsculas y espacios de los costados', () => {
      expect(normalizarParaBuscar('  Universidad Mayor de San Andrés ')).toBe(
        'universidad mayor de san andres',
      );
    });
  });

  describe('coincideConLaBusqueda', () => {
    const fila = ['Título profesional', 'MED-1000', 'Universidad Mayor de San Andrés (UMSA)'];

    it('«umsa» encuentra «UMSA»', () => {
      expect(coincideConLaBusqueda('umsa', fila)).toBe(true);
    });

    it('busca sin tildes lo que se escribió con tildes, y al revés', () => {
      expect(coincideConLaBusqueda('titulo', fila)).toBe(true);
      expect(coincideConLaBusqueda('ANDRÉS', ['Universidad Mayor de San Andres'])).toBe(true);
    });

    it('mira todos los campos, no sólo el primero', () => {
      expect(coincideConLaBusqueda('med-1000', fila)).toBe(true);
    });

    it('sin término deja pasar la fila', () => {
      expect(coincideConLaBusqueda('   ', fila)).toBe(true);
    });

    it('lo que no está en ningún campo no pasa', () => {
      expect(coincideConLaBusqueda('habana', fila)).toBe(false);
    });
  });

  describe('coincideConElEstado', () => {
    it('«pendiente» deja sólo los trámites abiertos', () => {
      expect(coincideConElEstado('pendiente', true)).toBe(true);
      expect(coincideConElEstado('pendiente', false)).toBe(false);
    });

    it('«verificado» deja sólo los ya revisados', () => {
      expect(coincideConElEstado('verificado', false)).toBe(true);
      expect(coincideConElEstado('verificado', true)).toBe(false);
    });

    it('sin filtro, o con un código desconocido, no esconde nada', () => {
      expect(coincideConElEstado(null, true)).toBe(true);
      expect(coincideConElEstado('otro', false)).toBe(true);
    });
  });

  describe('el filtro por concepto de las matrículas', () => {
    it('ofrece cada estado una vez, en el orden en que aparece, con la etiqueta de la tabla', () => {
      expect(
        estadosPresentes([
          { estadoConceptId: 'st-activo', estado: 'Activo' },
          { estadoConceptId: 'st-pendiente', estado: 'Pendiente' },
          { estadoConceptId: 'st-activo', estado: 'Activo' },
        ]),
      ).toEqual([
        { value: 'st-activo', label: 'Activo' },
        { value: 'st-pendiente', label: 'Pendiente' },
      ]);
      expect(estadosPresentes([])).toEqual([]);
    });

    it('sin filtro pasa todo; con filtro, sólo el mismo concepto', () => {
      expect(coincideConElConcepto(null, 'st-activo')).toBe(true);
      expect(coincideConElConcepto('st-activo', 'st-activo')).toBe(true);
      expect(coincideConElConcepto('st-pendiente', 'st-activo')).toBe(false);
    });
  });

  describe('filasDeLaPagina', () => {
    const doce = Array.from({ length: 12 }, (_, i) => i + 1);

    it('con doce filas y diez por página, la primera trae diez y la segunda dos', () => {
      expect(filasDeLaPagina(doce, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(filasDeLaPagina(doce, 2, 10)).toEqual([11, 12]);
    });

    it('una página que ya no existe muestra la última, como el paginador', () => {
      expect(filasDeLaPagina(doce, 3, 10)).toEqual([11, 12]);
      expect(filasDeLaPagina([1, 2], 2, 10)).toEqual([1, 2]);
    });

    it('una página imposible (0 o NaN) muestra la primera', () => {
      expect(filasDeLaPagina(doce, 0, 10)).toHaveLength(10);
      expect(filasDeLaPagina(doce, Number.NaN, 10)[0]).toBe(1);
    });
  });

  describe('una matrícula se corrige sólo mientras está pendiente', () => {
    it('pendiente con el código de la API o del simulador', () => {
      expect(matriculaPendiente('AUTH_PENDING')).toBe(true);
      expect(matriculaPendiente('ST-PENDING')).toBe(true);
      // La API publica el código con el prefijo del módulo (visto contra la API
      // real el 26/09/2026): sin esto la matrícula pendiente mostraba el sello.
      expect(matriculaPendiente('profiles:AUTH_PENDING')).toBe(true);
      expect(matriculaPendiente('profiles:AUTH_ACTIVE')).toBe(false);
    });

    it('activa o vencida ya no se corrige', () => {
      expect(matriculaPendiente('AUTH_ACTIVE')).toBe(false);
      expect(matriculaPendiente('AUTH_EXPIRED')).toBe(false);
      expect(matriculaPendiente('ST-ACTIVE')).toBe(false);
    });

    it('sin el código todavía, cuenta como pendiente', () => {
      expect(matriculaPendiente(undefined)).toBe(true);
    });
  });

  describe('la institución con su código (Q-8)', () => {
    it('la sigla sale de la etiqueta del catálogo, la misma que muestra el desplegable', () => {
      expect(codigoDeInstitucion('Universidad Mayor de San Andrés')).toBe('UMSA');
      expect(codigoDeInstitucion('Universidad Privada del Valle')).toBe('Univalle');
    });

    it('en la tabla, la institución del catálogo lleva su sigla al lado', () => {
      expect(institucionConCodigo('Universidad Mayor de San Andrés')).toBe(
        'Universidad Mayor de San Andrés (UMSA)',
      );
    });

    it('en el desplegable la sigla va adelante, para que el recorte a 375 px no se la lleve', () => {
      const etiqueta = (valor: string) =>
        OPCIONES_DE_INSTITUCION_CON_SIGLA.find((o) => o.value === valor)?.label;
      expect(etiqueta('Universidad Mayor de San Andrés')).toBe(
        'UMSA · Universidad Mayor de San Andrés — La Paz',
      );
      expect(etiqueta('Universidad Privada del Valle')).toBe(
        'Univalle · Universidad Privada del Valle',
      );
    });

    it('ninguna etiqueta conserva el paréntesis: toda sigla del catálogo quedó adelante', () => {
      expect(OPCIONES_DE_INSTITUCION_CON_SIGLA.filter((o) => o.label.includes('('))).toEqual([]);
    });

    it('sin sigla, la opción queda igual: separadores, «Universidad NUR» y la salida a mano', () => {
      const etiquetas = OPCIONES_DE_INSTITUCION_CON_SIGLA.map((o) => o.label);
      expect(etiquetas).toContain('Universidad NUR — Santa Cruz');
      expect(etiquetas).toContain('— Sistema de la Universidad Boliviana —');
      expect(etiquetas).toContain('Otra institución o estudié en el exterior…');
    });

    it('lo escrito a mano se muestra tal cual, aunque parezca una sigla', () => {
      expect(institucionConCodigo('Universidad de La Habana')).toBe('Universidad de La Habana');
      expect(institucionConCodigo('UMSA')).toBe('UMSA');
      expect(institucionConCodigo('—')).toBe('—');
    });

    it('sólo tres instituciones del catálogo no traen sigla en su etiqueta', () => {
      const sinSigla = [...UNIVERSIDADES_DEL_SISTEMA, ...UNIVERSIDADES_PRIVADAS]
        .filter((opcion) => codigoDeInstitucion(opcion.value) === null)
        .map((opcion) => opcion.value);

      expect(sinSigla).toEqual([
        'Universidad Nacional Siglo XX',
        'Universidad NUR',
        'Universidad Real de La Paz',
      ]);
    });
  });
});
