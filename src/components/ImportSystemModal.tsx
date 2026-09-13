import { useMemo, useState } from 'react';
import type { Block, Component, Mode, Project } from '../lib/model';
import { completeSystem, ensureColors, sampleContent, variantKey } from '../lib/catalog';
import { ROLES, buildTokens, candidatesFromText, emptyCandidates, mergeCandidates, mode as mostCommon, suggestMapping, validComponents, type Candidates } from '../lib/systemIO';
import { candidatesFromImage, candidatesFromPdf } from '../lib/pdfExtract';
import { extractSystem, fileToImage, fileToPdf, getAiKey, type ExtractedSystem } from '../lib/ai';
import { applyOps, saveVersion } from '../lib/store';
import { edit } from '../lib/ops';
import { colorValue, contrast } from '../lib/tokens';
import { notify } from '../lib/toast';
import { href } from '../lib/router';
import { BlockView } from './BlockView';
import { FitPreview } from './FitPreview';
import { Badge, Button, Field, Modal, Tabs } from './ui';
import { IconClose, IconSparkle, IconUpload } from './icons';

const ACCEPT = '.pdf,.json,.css,.scss,.sass,.less,.js,.cjs,.mjs,.ts,.html,.htm,.txt,.md,image/png,image/jpeg,image/webp,image/gif';
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f: File) => /^image\/(png|jpeg|webp|gif)$/.test(f.type);
const PREVIEW = ['navbar:title', 'heading:title', 'amount:', 'button:primary', 'button:secondary', 'tabs:underline', 'listItem:icon', 'alert:', 'accountCard:'];
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

/** Mezcla componentes externos con los del proyecto: el mismo patrón conserva identificador, nombre e instancias. */
function mergeComponents(existing: Component[], incoming: Component[]): Component[] {
  const out = [...existing];
  for (const c of incoming) {
    const i = out.findIndex((x) => x.type === c.type && (x.name.toLowerCase() === c.name.toLowerCase() || variantKey(x.type, x.variant) === variantKey(c.type, c.variant)));
    if (i >= 0) out[i] = { ...c, id: out[i].id, name: out[i].name };
    else out.push(c);
  }
  return out;
}

/** Importa un sistema de diseño desde los archivos del equipo. Se lee en el navegador y nada se aplica sin revisar. */
export function ImportSystemModal({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [cand, setCand] = useState<Candidates>(emptyCandidates);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [font, setFont] = useState('');
  const [radiusLg, setRadiusLg] = useState<number>();
  const [spaceLg, setSpaceLg] = useState<number>();
  const [ai, setAi] = useState<ExtractedSystem | null>(null);
  const [source, setSource] = useState<'map' | 'ai'>('map');
  const [previewMode, setPreviewMode] = useState<Mode>('light');
  const hasKey = !!getAiKey();

  const close = () => {
    setStep('upload');
    setFiles([]);
    setText('');
    setBusy('');
    setError('');
    setCand(emptyCandidates());
    setMapping({});
    setFont('');
    setRadiusLg(undefined);
    setSpaceLg(undefined);
    setAi(null);
    setSource('map');
    onClose();
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    setFiles((fs) => [...fs, ...[...list].filter((f) => !fs.some((x) => x.name === f.name && x.size === f.size))].slice(0, 10));
  };

  const analyze = async () => {
    setBusy('Leyendo archivos…');
    setError('');
    let acc = emptyCandidates();
    for (const f of files) {
      try {
        if (isPdf(f)) acc = mergeCandidates(acc, await candidatesFromPdf(f.name, await f.arrayBuffer()));
        else if (isImage(f)) acc = mergeCandidates(acc, await candidatesFromImage(f));
        else acc = mergeCandidates(acc, candidatesFromText(f.name, await f.text()));
      } catch (e) {
        acc = { ...acc, notes: [...acc.notes, `«${f.name}»: ${(e as Error).message}`] };
      }
    }
    if (text.trim()) acc = mergeCandidates(acc, candidatesFromText('Contenido pegado', text));
    setCand(acc);
    setMapping(acc.system ? {} : suggestMapping(acc.colors, p.tokens));
    setFont(acc.system ? '' : (acc.fonts[0] ?? ''));
    setRadiusLg(mostCommon(acc.radius.filter((v) => v >= 2 && v <= 40)));
    setSpaceLg(undefined);
    setAi(null);
    setSource('map');
    setBusy('');
    setStep('review');
  };

  const mapped = useMemo(
    () => (cand.system ? ensureColors(cand.system.tokens) : buildTokens(p.tokens, mapping, { font: font || undefined, radiusLg, spaceLg })),
    [cand, mapping, font, radiusLg, spaceLg, p.tokens],
  );
  const fromAi = source === 'ai' && !!ai;
  const tokens = fromAi ? ai!.tokens : mapped;
  const preview = useMemo(() => {
    const components = fromAi ? mergeComponents(p.components, ai!.components) : cand.system ? mergeComponents(p.components, validComponents(cand.system.components)) : p.components;
    return completeSystem({ ...p, tokens, components });
  }, [fromAi, ai, cand.system, p, tokens]);

  const runAi = async () => {
    setBusy('La IA está leyendo tus archivos. Puede tomar un minuto…');
    setError('');
    try {
      const images = await Promise.all(files.filter(isImage).slice(0, 5).map(fileToImage));
      const pdfs = await Promise.all(files.filter(isPdf).slice(0, 3).map(fileToPdf));
      const code = (await Promise.all(files.filter((f) => !isPdf(f) && !isImage(f)).map(async (f) => `/* ${f.name} */\n${await f.text()}`)))
        .concat(text.trim() ? [text] : [])
        .join('\n\n')
        .slice(0, 80000);
      const result = await extractSystem({ images, pdfs, code }, mapped);
      setAi(result);
      setSource('ai');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const apply = () => {
    const saved = saveVersion(p.id, 'Antes de importar un sistema de diseño', true);
    if (applyOps(p.id, [edit.project('tokens', preview.tokens), edit.project('components', preview.components)], 'Importar sistema de diseño')) {
      notify(saved ? 'Aplicaste el sistema importado. La versión anterior quedó en Historial.' : 'Aplicaste el sistema importado. Puedes deshacerlo con Cmd o Ctrl + Z.', 'success');
      close();
    }
  };

  const currentFamily = p.tokens.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  const fontOptions = [...new Set([...cand.fonts, currentFamily])];
  const onText = colorValue(tokens, 'onSurface', previewMode, '#111');

  return (
    <Modal
      open={open}
      xl
      title={step === 'upload' ? 'Importar sistema de diseño' : 'Revisar el sistema importado'}
      onClose={close}
      footer={
        step === 'upload' ? (
          <>
            <Button onClick={close}>Cancelar</Button>
            <Button tone="primary" disabled={!!busy || (!files.length && !text.trim())} onClick={analyze}>
              {busy || 'Analizar archivos'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep('upload')}>Volver</Button>
            <Button tone="primary" disabled={!!busy} onClick={apply}>
              Aplicar al sistema
            </Button>
          </>
        )
      }
    >
      {step === 'upload' ? (
        <div className="stack">
          <p className="muted modal-lede">Trae el sistema que ya usa tu equipo. Lo leemos en este navegador y nada se aplica hasta que lo revises.</p>
          <label
            className="drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            <IconUpload size={22} />
            <strong>Sube o arrastra archivos</strong>
            <span className="small">Hasta 10 archivos. PDF, JSON, CSS, SCSS, LESS, Tailwind, HTML o imágenes.</span>
          </label>
          {files.length > 0 && (
            <ul className="imp-files">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`}>
                  <span>
                    <strong>{f.name}</strong> <span className="muted">{kb(f.size)}</span>
                  </span>
                  <button type="button" className="icon-btn" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x !== f))}>
                    <IconClose size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="imp-formats">
            <li>
              <strong>PDF</strong> Guías de marca y manuales: colores de las muestras, hexadecimales escritos y fuentes.
            </li>
            <li>
              <strong>JSON</strong> Sistema exportado de Forma, W3C Design Tokens (Figma y Tokens Studio) y Style Dictionary.
            </li>
            <li>
              <strong>Código</strong> Variables CSS con modo oscuro, SCSS, LESS, tailwind.config y HTML con estilos.
            </li>
            <li>
              <strong>Imágenes</strong> Capturas o kits de UI: su paleta. Con IA, también componentes y tipografía.
            </li>
          </ul>
          <Field label="O pega código o tokens">
            <textarea className="input input-code" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={':root {\n  --color-primary: #1646C8;\n  --radius-lg: 16px;\n}'} />
          </Field>
          {error && <p className="error-text">{error}</p>}
        </div>
      ) : (
        <div className="stack">
          <div className="imp-summary">
            <span>
              <strong>{cand.sources.length}</strong> {cand.sources.length === 1 ? 'fuente' : 'fuentes'}
            </span>
            <span>
              <strong>{cand.system ? cand.system.tokens.colors.length : cand.colors.length}</strong> colores
            </span>
            <span>
              <strong>{cand.fonts.length}</strong> {cand.fonts.length === 1 ? 'fuente tipográfica' : 'fuentes tipográficas'}
            </span>
            {cand.system && (
              <span>
                <strong>{cand.system.components.length}</strong> componentes
              </span>
            )}
          </div>
          {cand.notes.length > 0 && (
            <ul className="plain-list small muted">
              {cand.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {!cand.system && !cand.colors.length && !cand.fonts.length && (
            <p className="notice">No encontramos colores ni tipografías legibles. Si subiste un PDF con texto en curvas o capturas, usa «Completar con IA».</p>
          )}
          {!cand.system && cand.colors.length > 0 && (
            <div className="imp-palette" aria-label="Colores detectados">
              {cand.colors.slice(0, 28).map((c) => (
                <span key={`${c.hex}-${c.name ?? ''}`} className="imp-chip" title={`${c.count} ${c.count === 1 ? 'aparición' : 'apariciones'}`}>
                  <i style={{ background: c.hex }} />
                  {c.name ? `${c.name} · ` : ''}
                  <code>{c.hex}</code>
                </span>
              ))}
            </div>
          )}

          <div className="imp-ai">
            <span>
              <strong>¿Faltan componentes o el modo oscuro?</strong>
              <span className="muted small"> La IA lee los PDF, las capturas y el código, y propone componentes con sus cinco estados usando tus tokens.</span>
            </span>
            {hasKey ? (
              <Button size="sm" disabled={!!busy || (!files.length && !text.trim())} onClick={runAi}>
                <IconSparkle size={14} /> {busy && busy.startsWith('La IA') ? 'Analizando…' : ai ? 'Volver a proponer' : 'Completar con IA'}
              </Button>
            ) : (
              <a className="btn btn-default btn-sm" href={href('/settings')} onClick={close}>
                Conectar IA en Ajustes
              </a>
            )}
          </div>
          {busy && <p className="muted small">{busy}</p>}
          {error && <p className="error-text">{error}</p>}
          {ai && (
            <Tabs
              small
              label="Qué aplicar"
              value={source}
              onChange={setSource}
              items={[
                { id: 'map', label: cand.system ? 'Archivo importado' : 'Mi mapeo' },
                { id: 'ai', label: `Propuesta de IA (${ai.components.length} componentes)` },
              ]}
            />
          )}
          {fromAi && ai!.notes && <p className="small">{ai!.notes}</p>}

          <div className="imp-review">
            <div className="stack">
              {cand.system && !fromAi && (
                <p className="notice">
                  Es un sistema exportado de Forma. Se aplican sus {cand.system.tokens.colors.length} colores, escalas y tipografía; sus componentes reemplazan a los del mismo patrón y conservan las instancias.
                </p>
              )}
              {!cand.system && !fromAi && (
                <>
                  <div className="table-wrap">
                    <table className="imp-roles">
                      <thead>
                        <tr>
                          <th>Rol</th>
                          <th>Actual</th>
                          <th>Color detectado</th>
                          <th>Hexadecimal</th>
                          <th>Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROLES.map((r) => {
                          const cur = p.tokens.colors.find((x) => x.name === r.name);
                          const value = mapping[r.name] ?? '';
                          const result = tokens.colors.find((x) => x.name === r.name);
                          const bg = tokens.colors.find((x) => x.name === 'background')?.light ?? '#FFFFFF';
                          const onPrimary = tokens.colors.find((x) => x.name === 'onPrimary')?.light;
                          const ratio = !result ? null : r.name === 'onSurface' || r.name === 'muted' ? contrast(result.light, bg) : r.name === 'primary' ? contrast(onPrimary, result.light) : null;
                          return (
                            <tr key={r.name}>
                              <td>
                                <strong>{r.label}</strong>
                                <div className="muted small">
                                  <code>{r.name}</code>
                                </div>
                              </td>
                              <td>
                                <span className="imp-swatch" style={{ background: cur?.light ?? 'transparent' }} title={cur?.light ?? 'No existe'} />
                              </td>
                              <td>
                                <select
                                  className="input"
                                  aria-label={`Color para ${r.label}`}
                                  value={cand.colors.some((c) => c.hex === value) ? value : ''}
                                  onChange={(e) =>
                                    setMapping((m) => {
                                      const next = { ...m };
                                      if (e.target.value) next[r.name] = e.target.value;
                                      else delete next[r.name];
                                      return next;
                                    })
                                  }
                                >
                                  <option value="">{cur ? 'Mantener actual' : 'Sin asignar'}</option>
                                  {cand.colors.map((c) => (
                                    <option key={`${c.hex}-${c.name ?? ''}`} value={c.hex}>
                                      {c.name ? `${c.name} · ${c.hex}` : c.hex}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="input input-code"
                                  aria-label={`Hexadecimal para ${r.label}`}
                                  placeholder="#RRGGBB"
                                  value={value}
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    setMapping((m) => {
                                      const next = { ...m };
                                      if (v) next[r.name] = v;
                                      else delete next[r.name];
                                      return next;
                                    });
                                  }}
                                />
                              </td>
                              <td className="nowrap">
                                {result && (
                                  <>
                                    <span className="imp-swatch" style={{ background: result.light }} title={`Claro ${result.light}`} /> <span className="imp-swatch" style={{ background: result.dark }} title={`Oscuro ${result.dark}`} />
                                  </>
                                )}{' '}
                                {ratio != null && (
                                  <Badge tone={ratio >= 4.5 ? 'ok' : 'err'}>
                                    {String(ratio).replace('.', ',')}:1
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted small">Hover, presionado, suaves y modo oscuro se derivan solos, con contraste AA. Los roles sin asignar conservan su valor.</p>
                  <div className="grid-2">
                    <Field label="Tipografía" hint="Se carga desde Google Fonts si existe.">
                      <input className="input" list="imp-fonts" value={font} placeholder={currentFamily} onChange={(e) => setFont(e.target.value)} />
                      <datalist id="imp-fonts">
                        {fontOptions.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </Field>
                    <Field label="Radio grande (px)" hint={cand.radius.length ? `Detectamos ${[...new Set(cand.radius)].slice(0, 5).join(', ')} px.` : 'Define sm y md en proporción.'}>
                      <input className="input" type="number" min={0} max={40} value={radiusLg ?? ''} placeholder={String(p.tokens.radius.find((r) => r.name === 'lg')?.value ?? 16)} onChange={(e) => setRadiusLg(e.target.value ? Number(e.target.value) : undefined)} />
                    </Field>
                    <Field label="Espaciado base (px)" hint="Escala xs a xxl desde este valor.">
                      <input className="input" type="number" min={4} max={40} value={spaceLg ?? ''} placeholder={String(p.tokens.space.find((s) => s.name === 'lg')?.value ?? 16)} onChange={(e) => setSpaceLg(e.target.value ? Number(e.target.value) : undefined)} />
                    </Field>
                  </div>
                </>
              )}
              {fromAi && (
                <div className="imp-palette">
                  {ai!.tokens.colors.map((c) => (
                    <span key={c.name} className="imp-chip">
                      <i style={{ background: c[previewMode] }} />
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="imp-preview" style={{ backgroundColor: colorValue(tokens, 'background', previewMode, '#FFFFFF') }}>
              <div className="row between">
                <strong style={{ color: onText }}>Vista previa</strong>
                <Tabs
                  small
                  label="Modo de la vista previa"
                  value={previewMode}
                  onChange={setPreviewMode}
                  items={[
                    { id: 'light', label: 'Claro' },
                    { id: 'dark', label: 'Oscuro' },
                  ]}
                />
              </div>
              {PREVIEW.map((k) => {
                const comp = preview.components.find((x) => variantKey(x.type, x.variant) === k);
                if (!comp) return null;
                return (
                  <FitPreview key={k} width={343}>
                    <BlockView project={preview} block={{ id: `imp-${k}`, type: comp.type, componentId: comp.id, ...sampleContent(comp.type, comp.variant, p.brand) } as Block} mode={previewMode} />
                  </FitPreview>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
