import { emptyCandidates, rgbToHex, scanNamedHex, type Candidates } from './systemIO';

// Lectura local de PDF e imágenes, sin dependencias: sirve sin clave de IA.
// Del PDF salen los colores con que se pintan las muestras (operadores rg y k),
// los textos legibles (por ejemplo «Primario #0074C8») y los nombres de las fuentes.

const unescapePdf = (s: string) =>
  s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c: string) => {
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[c] ?? c;
  });

/** Colores y texto de un flujo de contenido ya descomprimido. */
export function scanContent(content: string, colors: Map<string, number>, texts: string[]) {
  const add = (hex: string) => colors.set(hex, (colors.get(hex) ?? 0) + 1);
  const unit = (v: string) => Math.max(0, Math.min(1, parseFloat(v)));
  for (const m of content.matchAll(/(?<![\d.])(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+(?:rg|RG|scn?|SCN?)\b/g)) {
    add(rgbToHex([unit(m[1]) * 255, unit(m[2]) * 255, unit(m[3]) * 255]));
  }
  for (const m of content.matchAll(/(?<![\d.])(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+[kK]\b/g)) {
    const [c, mg, y, k] = [m[1], m[2], m[3], m[4]].map(unit);
    add(rgbToHex([255 * (1 - c) * (1 - k), 255 * (1 - mg) * (1 - k), 255 * (1 - y) * (1 - k)]));
  }
  for (const m of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) texts.push(unescapePdf(m[1]));
  for (const m of content.matchAll(/\[((?:\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ/g)) {
    texts.push([...m[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((x) => unescapePdf(x[1])).join(''));
  }
}

async function inflate(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
    const buf = await new Response(stream).arrayBuffer();
    return new TextDecoder('latin1').decode(buf);
  } catch {
    return null;
  }
}

export interface PdfRead {
  pages: number;
  fonts: string[];
  colors: { hex: string; count: number }[];
  text: string;
}

export function fontsFromPdf(raw: string): string[] {
  const out: string[] = [];
  for (const m of raw.matchAll(/\/BaseFont\s*\/([^\s/[\]<>()]+)/g)) {
    const name = m[1]
      .replace(/^[A-Z]{6}\+/, '')
      .replace(/#([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .split(/[-,]/)[0]
      .replace(/(MT|PS)$/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    if (name && !/^(Symbol|Zapf|Dingbats|Times|Helvetica|Courier|Arial)/i.test(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

export async function readPdf(buffer: ArrayBuffer): Promise<PdfRead> {
  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder('latin1').decode(bytes);
  if (!raw.startsWith('%PDF')) throw new Error('El archivo no es un PDF válido.');
  const colors = new Map<string, number>();
  const texts: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let scanned = 0;
  while ((m = re.exec(raw)) && scanned < 400) {
    // «endstream» también contiene «stream»: esa coincidencia no abre un flujo.
    if (raw.slice(Math.max(0, m.index - 3), m.index) === 'end') continue;
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const dict = raw.slice(Math.max(0, m.index - 900), m.index);
    const dictStart = dict.lastIndexOf('<<');
    const head = dictStart >= 0 ? dict.slice(dictStart) : dict;
    re.lastIndex = end + 'endstream'.length;
    if (/\/Subtype\s*\/Image|\/Length[123]\b|\/FontFile|\/Type\s*\/XRef|\/Type\s*\/ObjStm|\/Subtype\s*\/(Type1C|CIDFontType0C|OpenType)/.test(head)) continue;
    let data = bytes.subarray(start, end);
    while (data.length && (data[data.length - 1] === 10 || data[data.length - 1] === 13)) data = data.subarray(0, data.length - 1);
    if (data.length > 8_000_000) continue;
    const content = /\/FlateDecode/.test(head) ? await inflate(data) : /\/Filter/.test(head) ? null : raw.slice(start, end);
    if (content) {
      scanContent(content, colors, texts);
      scanned++;
    }
  }
  return {
    pages: (raw.match(/\/Type\s*\/Page(?!s)/g) ?? []).length,
    fonts: fontsFromPdf(raw),
    colors: [...colors.entries()].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count),
    text: texts.join('\n'),
  };
}

const distance = (a: string, b: string) => {
  const x = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const y = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/** Agrupa colores casi iguales y deja los más frecuentes. */
export function clusterColors(list: { hex: string; count: number }[], limit = 14): { hex: string; count: number }[] {
  const out: { hex: string; count: number }[] = [];
  for (const c of [...list].sort((a, b) => b.count - a.count)) {
    const near = out.find((o) => distance(o.hex, c.hex) < 26);
    if (near) near.count += c.count;
    else out.push({ ...c });
  }
  return out.slice(0, limit);
}

export async function candidatesFromPdf(fileName: string, buffer: ArrayBuffer): Promise<Candidates> {
  const c = emptyCandidates();
  c.sources.push(fileName);
  const pdf = await readPdf(buffer);
  scanNamedHex(c, pdf.text);
  for (const col of clusterColors(pdf.colors)) {
    const same = c.colors.find((x) => distance(x.hex, col.hex) < 12);
    if (same) same.count += col.count;
    else c.colors.push({ hex: col.hex, count: col.count });
  }
  pdf.fonts.forEach((f) => !c.fonts.includes(f) && c.fonts.push(f));
  c.notes.push(
    `«${fileName}»: ${pdf.pages} ${pdf.pages === 1 ? 'página' : 'páginas'}, ${c.colors.length} colores y ${pdf.fonts.length} ${pdf.fonts.length === 1 ? 'fuente' : 'fuentes'} detectados.` +
      (pdf.text.trim() ? '' : ' El texto del PDF no es legible sin IA: se usaron los colores de las muestras.'),
  );
  return c;
}

/** Paleta de una imagen: reduce a 72 px, cuantiza y agrupa los colores más presentes. */
export async function candidatesFromImage(file: File): Promise<Candidates> {
  const c = emptyCandidates();
  c.sources.push(file.name);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`No pudimos leer «${file.name}».`));
      el.src = url;
    });
    const scale = Math.min(1, 72 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const q = (v: number) => Math.round(v / 12) * 12;
      const hex = rgbToHex([q(data[i]), q(data[i + 1]), q(data[i + 2])]);
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    c.colors = clusterColors([...counts.entries()].map(([hex, count]) => ({ hex, count })), 12);
    c.notes.push(`«${file.name}»: paleta de ${c.colors.length} colores. Para detectar componentes y tipografía, usa «Completar con IA».`);
  } finally {
    URL.revokeObjectURL(url);
  }
  return c;
}
