import type { ReplyTemplate, SupportConversation } from '../../../core/data-access/support-access/support-inbox.types';
import {
  appendDraft,
  applyTemplate,
  conversationActions,
  groupTemplates,
  needsDerivation,
  onBehalfNotice,
  patientFirstName,
  replyRule,
} from './conversation-model';

function estado(parcial: Partial<SupportConversation> = {}): Pick<
  SupportConversation,
  'status' | 'isClinical' | 'assignedToMe' | 'assignedToName' | 'assignableTo'
> {
  return {
    status: 'NEW',
    isClinical: false,
    assignedToMe: false,
    assignableTo: [
      { userId: 'u-ana', name: 'Ana Gutiérrez' },
      { userId: 'u-mariela', name: 'Mariela Soliz' },
    ],
    ...parcial,
  };
}

describe('aviso de «respondes como»', () => {
  it('con el aviso activo, el paciente verá «respondido por su equipo» y la autora queda registrada', () => {
    const texto = onBehalfNotice('Dr. Andrés Pérez', 'SHOW');
    expect(texto).toContain('Está respondiendo como Dr. Andrés Pérez.');
    expect(texto).toContain('El paciente verá «respondido por su equipo».');
    expect(texto).toContain('Su nombre queda registrado como autora.');
  });

  it('con el aviso apagado por el doctor, lo dice y sigue registrando a la autora', () => {
    const texto = onBehalfNotice('Dra. Paola Céspedes', 'HIDE');
    expect(texto).toContain('Está respondiendo como Dra. Paola Céspedes.');
    expect(texto).toContain('El paciente no verá que respondió su equipo');
    expect(texto).toContain('así lo configuró el doctor');
    expect(texto).toContain('Su nombre queda registrado como autora.');
  });
});

describe('qué se puede enviar', () => {
  it('una conversación nueva y administrativa se responde, con «enviar» como botón principal', () => {
    expect(replyRule(estado())).toEqual({ canSend: true, block: null, reason: null, primary: 'SEND' });
  });

  it('un mensaje clínico no se responde: el botón principal es derivar', () => {
    const regla = replyRule(estado({ isClinical: true }));
    expect(regla.canSend).toBe(false);
    expect(regla.block).toBe('CLINICAL');
    expect(regla.primary).toBe('DERIVE');
    expect(regla.reason).toContain('clínico');
    expect(needsDerivation({ status: 'NEW', isClinical: true })).toBe(true);
  });

  it('ya derivado al doctor, se vuelve a poder escribir (por ejemplo, avisar al paciente) y el principal es enviar', () => {
    const regla = replyRule(estado({ status: 'WAITING_DOCTOR', isClinical: true, assignedToMe: true }));
    expect(regla.canSend).toBe(true);
    expect(regla.primary).toBe('SEND');
    expect(needsDerivation({ status: 'WAITING_DOCTOR', isClinical: true })).toBe(false);
  });

  it('ya no hay un estado «sin permiso de responder»: la API solo muestra la conversación a quien puede responder', () => {
    // `replyAllowed` es siempre verdadero en lo que se ve; quien no puede, no recibe la conversación (404).
    const regla = replyRule(estado());
    expect(regla.canSend).toBe(true);
    expect(regla.block).toBeNull();
  });

  it('si la tiene otra persona, no se envía y se dice quién', () => {
    const regla = replyRule(estado({ status: 'TAKEN', assignedToMe: false, assignedToName: 'Mariela Soliz' }));
    expect(regla.canSend).toBe(false);
    expect(regla.block).toBe('OWNED_BY_OTHER');
    expect(regla.reason).toContain('Mariela Soliz');
  });

  it('quien la tiene sí responde', () => {
    expect(replyRule(estado({ status: 'TAKEN', assignedToMe: true })).canSend).toBe(true);
  });

  it('una resuelta se puede volver a responder (la reabre)', () => {
    expect(replyRule(estado({ status: 'RESOLVED' })).canSend).toBe(true);
  });

  it('el dueño pesa más que el contenido clínico: se explica lo que no se puede cambiar desde acá', () => {
    const regla = replyRule(estado({ isClinical: true, status: 'TAKEN', assignedToName: 'Mariela' }));
    expect(regla.block).toBe('OWNED_BY_OTHER');
  });
});

describe('acciones sobre la conversación', () => {
  it('una nueva se puede tomar, asignar y derivar, pero no resolver ni liberar', () => {
    expect(conversationActions(estado())).toEqual({ take: true, assign: true, release: false, derive: true, resolve: false, reopen: false });
  });

  it('en curso y mía: se puede liberar, asignar, derivar y resolver, pero no tomar', () => {
    expect(conversationActions(estado({ status: 'TAKEN', assignedToMe: true }))).toEqual({ take: false, assign: true, release: true, derive: true, resolve: true, reopen: false });
  });

  it('en curso de otra persona: no se puede hacer nada con ella', () => {
    expect(conversationActions(estado({ status: 'TAKEN', assignedToMe: false, assignedToName: 'Mariela' }))).toEqual({
      take: false,
      assign: false,
      release: false,
      derive: false,
      resolve: false,
      reopen: false,
    });
  });

  it('esperando al doctor y mía: solo se puede resolver o asignar; ya no se deriva', () => {
    const acciones = conversationActions(estado({ status: 'WAITING_DOCTOR', assignedToMe: true }));
    expect(acciones.derive).toBe(false);
    expect(acciones.resolve).toBe(true);
    expect(acciones.take).toBe(false);
  });

  it('una resuelta solo se reabre', () => {
    expect(conversationActions(estado({ status: 'RESOLVED' }))).toEqual({ take: false, assign: false, release: false, derive: false, resolve: false, reopen: true });
  });

  it('asignar necesita a alguien más a quien asignar', () => {
    expect(conversationActions(estado({ assignableTo: [{ userId: 'u-ana', name: 'Ana' }] })).assign).toBe(false);
  });
});

describe('plantillas de respuesta rápida', () => {
  const plantillas: ReplyTemplate[] = [
    { id: '1', category: 'BILLING', title: 'Costos', bodyText: 'Hola {paciente}, el costo lo confirma caja.' },
    { id: '2', category: 'GENERAL', title: 'Recibimos', bodyText: 'Recibimos su mensaje.' },
    { id: '3', category: 'GENERAL', title: 'Derivado', bodyText: 'Hola {paciente}, {doctor} le responderá.' },
    { id: '4', category: 'SCHEDULING', title: 'Otro horario', bodyText: 'Podemos reprogramar con {doctor}.' },
  ];

  it('agrupa por categoría en el orden fijo y omite las vacías', () => {
    const grupos = groupTemplates(plantillas);
    expect(grupos.map((g) => g.category)).toEqual(['GENERAL', 'SCHEDULING', 'BILLING']);
    expect(grupos[0]!.label).toBe('General');
    expect(grupos[0]!.items.map((t) => t.id)).toEqual(['2', '3']);
    expect(groupTemplates([])).toEqual([]);
  });

  it('el nombre del paciente es su primer nombre', () => {
    expect(patientFirstName('Ana Lucía Pérez Quiroga')).toBe('Ana');
    // Un rótulo viejo, con el documento, tampoco se rompe.
    expect(patientFirstName('Ana Lucía Pérez Quiroga · CI ***321')).toBe('Ana');
    expect(patientFirstName('Jorge')).toBe('Jorge');
    expect(patientFirstName('')).toBe('paciente');
  });

  it('completa {paciente} y {doctor}, todas las veces, y deja lo desconocido', () => {
    const texto = applyTemplate('Hola {paciente}. {doctor} te verá, {paciente}. {otro}', { patientLabel: 'Ana Lucía Pérez', doctorName: 'Dr. Andrés Pérez' });
    expect(texto).toBe('Hola Ana. Dr. Andrés Pérez te verá, Ana. {otro}');
  });

  it('agrega al borrador sin pisarlo', () => {
    expect(appendDraft('', 'Hola')).toBe('Hola');
    expect(appendDraft('Primero esto.  \n', 'Y esto.')).toBe('Primero esto.\nY esto.');
  });
});
