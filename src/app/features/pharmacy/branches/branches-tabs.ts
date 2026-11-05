/**
 * Tabs of the pharmacy "Sucursales" hub, in drawing order. The key travels in
 * `?tab=`: the old "Horario y turnos" route redirects to `?tab=horario`
 * (`app.routes.ts`).
 */
export const BRANCHES_TABS = ['sucursales', 'horario'] as const;

export type BranchesTab = (typeof BRANCHES_TABS)[number];

export const BRANCHES_TAB_LABELS: Readonly<Record<BranchesTab, string>> = {
  sucursales: 'Sucursales',
  horario: 'Horario y turnos',
};

/** Missing or unknown value opens the first tab. */
export function branchesTabIndexOf(raw: string | null | undefined): number {
  const index = BRANCHES_TABS.indexOf(raw as BranchesTab);
  return index < 0 ? 0 : index;
}

export function branchesTabKeyOf(index: number): BranchesTab {
  return BRANCHES_TABS[index] ?? BRANCHES_TABS[0];
}
