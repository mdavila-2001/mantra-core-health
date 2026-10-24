export type OnboardingFormType =
  | 'patient'
  | 'practitioner'
  | 'organization'
  | 'laboratory'
  | 'imaging-center'
  | 'pharmacy';

export interface OnboardingDraft<T = Record<string, unknown>> {
  readonly draftId: string;
  readonly formType: OnboardingFormType;
  readonly stepIndex: number;
  readonly stepKey?: string;
  readonly stepTitle?: string;
  readonly data: T;
  readonly extraData?: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly percentComplete: number;
}

export type OnboardingEventType =
  | 'start'
  | 'step_view'
  | 'field_interaction'
  | 'field_error'
  | 'abandon'
  | 'complete';

export interface OnboardingTelemetryEvent {
  readonly eventType: OnboardingEventType;
  readonly formType: OnboardingFormType;
  readonly draftId: string;
  readonly stepIndex: number;
  readonly stepKey?: string;
  readonly fieldKey?: string;
  readonly interactionType?: 'focus' | 'blur' | 'change' | 'error';
  readonly errorCategory?: string;
  readonly durationMs?: number;
  readonly timestamp: string;
}

export interface OnboardingFunnelStep {
  readonly stepNumber: number;
  readonly stepKey: string;
  readonly stepTitle: string;
  readonly reachedCount: number;
  readonly conversionFromStart: number;
  readonly conversionFromPrevious: number | null;
  readonly droppedFromPrevious: number | null;
  readonly averageDwellSeconds: number;
}

export interface OnboardingFunnelReport {
  readonly formType: OnboardingFormType;
  readonly totalStarted: number;
  readonly totalCompleted: number;
  readonly overallConversion: number;
  readonly bottleneckStepNumber: number | null;
  readonly averageCompletionMinutes: number;
  readonly steps: readonly OnboardingFunnelStep[];
}

export interface OnboardingFieldHeatmap {
  readonly fieldKey: string;
  readonly fieldLabel: string;
  readonly stepNumber: number;
  readonly stepKey: string;
  readonly interactionCount: number;
  readonly errorCount: number;
  readonly abandonmentCount: number;
  readonly averageTimeMs: number;
  /** Intensidad relativa calculada en base 0-100 para la escala térmica. */
  readonly thermalScore: number;
  /** Nivel de alerta: normal, moderado o crítico. */
  readonly thermalLevel: 'low' | 'medium' | 'critical';
}

export interface OnboardingHeatmapReport {
  readonly formType: OnboardingFormType;
  readonly metric: 'interactions' | 'errors' | 'abandonment';
  readonly totalInteractions: number;
  readonly totalErrors: number;
  readonly totalAbandons: number;
  readonly fields: readonly OnboardingFieldHeatmap[];
}
