import type { MembershipListItem, MyOrganization } from '../../../core/data-access/directory/directory.types';
import { organizationChecklist, summarizeTeam } from './organization-home.model';

const NOW = new Date('2026-11-05T12:00:00Z');
const base = { id: 't-1', legalName: 'Los Pinos' } as MyOrganization;
const org = (extra: Partial<MyOrganization>): MyOrganization => ({ ...base, ...extra });
const item = (items: ReturnType<typeof organizationChecklist>, key: string) => items.find((i) => i.key === key)!;

describe('organizationChecklist', () => {
  it('flags what is missing without inventing it', () => {
    const list = organizationChecklist(org({}), false, NOW);

    expect(item(list, 'data').state).toBe('pending');
    expect(item(list, 'representative').state).toBe('pending');
    expect(item(list, 'documents').detail).toBe('Todavía no hay documentos en su carpeta.');
    expect(item(list, 'logo').state).toBe('pending');
  });

  it('is all in order when everything is registered and verified', () => {
    const list = organizationChecklist(
      org({
        taxIdentifier: '123',
        legalRepresentative: { role: 'LEGAL_REPRESENTATIVE', fullName: 'Wendy Dávila' },
        legalDocuments: [
          { role: 'A', verificationStatus: 'VERIFICADO' },
          { role: 'B', verificationStatus: 'VERIFICADO', validTo: new Date('2027-06-01') },
        ],
      }),
      true,
      NOW,
    );

    expect(list.map((i) => i.state)).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(item(list, 'documents').detail).toBe('2 verificados.');
  });

  it('asks for attention on refused, expired or soon-to-expire papers', () => {
    const list = organizationChecklist(
      org({
        legalDocuments: [
          { role: 'A', verificationStatus: 'RECHAZADO' },
          { role: 'B', verificationStatus: 'VENCIDO' },
          { role: 'C', verificationStatus: 'VERIFICADO', validTo: new Date('2026-11-20') },
        ],
      }),
      true,
      NOW,
    );

    expect(item(list, 'documents')).toMatchObject({
      state: 'attention',
      detail: '1 rechazado, 1 vencido, 1 vence pronto.',
    });
  });

  it('reports papers still under review as pending', () => {
    const list = organizationChecklist(org({ legalDocuments: [{ role: 'A', verificationStatus: 'PENDIENTE' }] }), null, NOW);

    expect(item(list, 'documents')).toMatchObject({ state: 'pending', detail: '1 en revisión de 1.' });
    expect(item(list, 'logo').detail).toBe('No se pudo comprobar.');
  });
});

describe('summarizeTeam', () => {
  const member = (tenantRoleCode?: string): MembershipListItem =>
    ({ id: 'm', userId: 'u', tenantRoleConceptId: 'c', statusConceptId: 's', createdAt: NOW, tenantRoleCode }) as MembershipListItem;

  it('counts people by role in words and groups the unlabelled ones', () => {
    const summary = summarizeTeam([member('OWNER'), member('STAFF'), member('STAFF'), member()], false);

    expect(summary.total).toBe(4);
    expect(summary.byRole).toEqual([
      { label: 'Dueños', count: 1 },
      { label: 'Equipo', count: 2 },
      { label: 'Otros', count: 1 },
    ]);
  });
});
