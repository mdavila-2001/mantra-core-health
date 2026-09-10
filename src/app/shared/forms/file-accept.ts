/** Semántica del atributo accept, compartida por selección y arrastre. */
export function matchesFileAccept(file: File, accept: string): boolean {
  const patterns = accept
    .split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean);
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    patterns.length === 0 ||
    patterns.some((pattern) => {
      if (pattern === '*/*') return true;
      if (pattern.startsWith('.')) return name.endsWith(pattern);
      if (pattern.endsWith('/*')) return mime.startsWith(pattern.slice(0, -1));
      return mime === pattern;
    })
  );
}
