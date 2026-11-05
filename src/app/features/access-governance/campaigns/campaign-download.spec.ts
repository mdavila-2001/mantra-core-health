import { OBJECT_URL_RELEASE_MS } from '../../../shared/utils/file-download/release-object-url';
import { downloadText, exportFileName } from './campaign-download';

describe('campaign-download', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('nombra el archivo con la campaña y su formato, sin caracteres raros', () => {
    expect(exportFileName('Certificación Q4-2026', 'csv', new Date('2026-11-03T12:00:00Z'))).toBe(
      'certificacion-q4-2026-2026-11-03.csv',
    );
    expect(exportFileName('   ', 'json', new Date('2026-11-03T12:00:00Z'))).toBe(
      'campana-2026-11-03.json',
    );
  });

  it('entrega el contenido como archivo con el tipo que le corresponde', async () => {
    const creado: Blob[] = [];
    const ancla = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const doc = {
      createElement: vi.fn(() => ancla),
      body: { append: vi.fn() },
    } as unknown as Document;
    const url = {
      createObjectURL: vi.fn((b: Blob) => (creado.push(b), 'blob:x')),
      revokeObjectURL: vi.fn(),
    };
    downloadText(doc, url, 'a.csv', 'csv', 'persona,estado\nAna,PENDING');
    expect(ancla.download).toBe('a.csv');
    expect(ancla.href).toBe('blob:x');
    expect(ancla.click).toHaveBeenCalledOnce();
    // F8: se revoca después, no en el mismo tick que el clic (Safari y Firefox cancelarían la descarga).
    expect(url.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OBJECT_URL_RELEASE_MS);
    expect(url.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:x');
    expect(creado[0]?.type).toContain('text/csv');
    expect(await creado[0]?.text()).toBe('persona,estado\nAna,PENDING');
  });
});
