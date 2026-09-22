import { useMemo, useState } from 'react';
import type { Project, Screen } from '../lib/model';
import { applyOps } from '../lib/store';
import { edit } from '../lib/ops';
import { checkProject } from '../lib/flowCheck';
import { useCloudAccount } from './useCloudAccount';
import { critiqueScreen, fileToImage, generateScreen, iaDisponible, proposalToScreen, type Critique, type ImageInput, type ScreenProposal, type Turn } from '../lib/ai';
import { notify } from '../lib/toast';
import { href } from '../lib/router';
import { ScreenCanvas } from './ScreenCanvas';
import { Badge, Button, Empty, Tabs } from './ui';

const conversations = new Map<string, Turn[]>();

export function CopilotPanel({
  project,
  screen,
  editable,
  onApplied,
  onSelectBlock,
}: {
  project: Project;
  screen: Screen;
  editable: boolean;
  onApplied: (screenId: string) => void;
  onSelectBlock: (blockId: string) => void;
}) {
  const [mode, setMode] = useState<'generate' | 'critique'>('generate');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<Turn[]>(() => conversations.get(project.id) ?? []);
  const [proposal, setProposal] = useState<ScreenProposal | null>(null);
  const [critique, setCritique] = useState<Critique | null>(null);
  const [image, setImage] = useState<ImageInput | null>(null);
  const preview = useMemo(() => (proposal ? proposalToScreen(project, proposal) : null), [proposal, project]);
  const { account } = useCloudAccount();

  if (iaDisponible(account?.email) === 'no')
    return (
      <Empty
        title="Conecta la IA"
        action={
          <a className="btn btn-default btn-sm" href={href('/settings')}>
            Ir a Ajustes
          </a>
        }
      >
        Guarda tu acceso con correo para usar la IA del equipo en cualquier navegador, o agrega tu propia clave de API.
      </Empty>
    );

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await generateScreen(project, turns, prompt.trim(), image ?? undefined);
      // El historial guarda solo texto para no reenviar imágenes en cada ajuste.
      const said = image ? `${prompt.trim()} (con la imagen «${image.name}»)` : prompt.trim();
      const next: Turn[] = [...turns, { role: 'user' as const, content: said }, { role: 'assistant' as const, content: JSON.stringify(result) }].slice(-12);
      conversations.set(project.id, next);
      setTurns(next);
      setProposal(result);
      setPrompt('');
      setImage(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runCritique = async () => {
    setBusy(true);
    setError('');
    try {
      setCritique(await critiqueScreen(project, screen, checkProject(project).filter((i) => i.screenId === screen.id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Tabs
        small
        label="Modo del copiloto"
        value={mode}
        onChange={setMode}
        items={[
          { id: 'generate', label: 'Proponer' },
          { id: 'critique', label: 'Criticar' },
        ]}
      />

      {mode === 'generate' && (
        <>
          {turns.filter((t) => t.role === 'user').length > 0 && (
            <ol className="convo">
              {turns
                .filter((t) => t.role === 'user')
                .map((t, i) => (
                  <li key={i}>{typeof t.content === 'string' ? t.content : 'Mensaje con imagen'}</li>
                ))}
            </ol>
          )}
          <textarea
            className="input"
            rows={3}
            aria-label="Qué pantalla necesitas"
            placeholder={turns.length ? 'Pide un ajuste a la propuesta anterior' : 'Ej: pantalla para programar una transferencia recurrente'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate();
            }}
          />
          <div className="attach-row">
            <label className="btn btn-default btn-sm">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    setImage(await fileToImage(f));
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              />
              Adjuntar captura o boceto
            </label>
            {image && (
              <span className="attach-chip">
                <img src={`data:${image.mediaType};base64,${image.data}`} alt="" />
                {image.name}
                <button type="button" className="link-btn" onClick={() => setImage(null)}>
                  Quitar
                </button>
              </span>
            )}
          </div>
          <p className="muted small">La propuesta usa solo los componentes de tu sistema de diseño.</p>
          <div className="row">
            <Button tone="primary" size="sm" disabled={busy || !prompt.trim()} onClick={generate}>
              {busy ? 'Pensando…' : turns.length ? 'Pedir ajuste' : 'Proponer pantalla'}
            </Button>
            {turns.length > 0 && (
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  conversations.delete(project.id);
                  setTurns([]);
                  setProposal(null);
                }}
              >
                Nueva conversación
              </Button>
            )}
          </div>
          {proposal && preview && (
            <div className="proposal">
              <strong>{proposal.name}</strong>
              <p className="muted small">{proposal.rationale}</p>
              <div className="proposal-canvas">
                <ScreenCanvas project={project} screen={preview} mode="light" />
              </div>
              <p className="muted small">Nada se aplica hasta que lo agregues.</p>
              <div className="row">
                <Button
                  tone="primary"
                  size="sm"
                  disabled={!editable}
                  onClick={() => {
                    if (applyOps(project.id, [edit.addScreen(project, preview)], `Agregar pantalla propuesta: «${preview.name}»`)) {
                      notify(`Agregaste «${preview.name}». Conecta sus acciones desde el inspector.`, 'success');
                      onApplied(preview.id);
                      setProposal(null);
                    }
                  }}
                >
                  Agregar como pantalla nueva
                </Button>
                <Button size="sm" tone="ghost" onClick={() => setProposal(null)}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'critique' && (
        <>
          <p className="muted small">El copiloto señala problemas en «{screen.name}». Tú decides qué cambiar.</p>
          <Button size="sm" disabled={busy} onClick={runCritique}>
            {busy ? 'Revisando…' : `Criticar «${screen.name}»`}
          </Button>
          {critique && (
            <div className="stack">
              <p>{critique.summary}</p>
              <ul className="plain-list">
                {critique.observations.map((o, i) => {
                  const exists = screen.blocks.some((b) => b.id === o.block_id);
                  return (
                    <li key={i} className="observation">
                      <Badge tone={o.severity === 'alta' ? 'err' : o.severity === 'media' ? 'warn' : 'neutral'}>Severidad {o.severity}</Badge>
                      <p>{o.note}</p>
                      {exists && (
                        <button type="button" className="link-btn" onClick={() => onSelectBlock(o.block_id)}>
                          Ver bloque
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
