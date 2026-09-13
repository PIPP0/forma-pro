import { useMemo, useState } from 'react';
import type { Project, Role } from '../lib/model';
import { applyOps } from '../lib/store';
import { can } from '../lib/permissions';
import { edit } from '../lib/ops';
import { fileToImage, generateScreen, getAiKey, proposalToScreen, type ImageInput, type ScreenProposal } from '../lib/ai';
import { notify } from '../lib/toast';
import { go, href } from '../lib/router';
import { ScreenCanvas } from './ScreenCanvas';
import { Button, Modal } from './ui';
import { IconFileImage, IconSparkle } from './icons';

const SUGGESTIONS = ['Mejora las ayudas del formulario', 'Agrega un flujo de transferencia', 'Crea una tarjeta de ahorro'];

/** «Diseña con tu asistente»: propone una pantalla editable con los componentes y tokens del proyecto. */
export function AssistantModal({ project, role, open, onClose }: { project: Project; role: Role; open: boolean; onClose: () => void }) {
  const editable = can(role, 'edit');
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<ImageInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<ScreenProposal | null>(null);
  const hasKey = open && !!getAiKey();
  const screen = useMemo(() => (proposal ? proposalToScreen(project, proposal) : null), [proposal, project]);

  const close = () => {
    setPrompt('');
    setImage(null);
    setError('');
    setProposal(null);
    onClose();
  };

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      setProposal(await generateScreen(project, [], prompt.trim(), image ?? undefined));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addToFlow = () => {
    if (!screen) return;
    if (applyOps(project.id, [edit.addScreen(project, screen)], `Agregar «${screen.name}» propuesta por el asistente`)) {
      notify(`Agregaste «${screen.name}» al flujo. Conecta sus acciones desde Propiedades.`, 'success');
      close();
      go(`/p/${project.id}/screens?s=${screen.id}`);
    }
  };

  return (
    <Modal
      open={open}
      title="Diseña con tu asistente"
      onClose={close}
      wide={!!screen}
      footer={
        screen ? (
          <>
            <Button onClick={() => setProposal(null)}>Pedir otra propuesta</Button>
            <Button tone="primary" disabled={!editable} onClick={addToFlow}>
              <IconSparkle size={16} /> Agregar al flujo
            </Button>
          </>
        ) : (
          <>
            <label className={`btn btn-outline ${busy ? 'is-disabled' : ''}`}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={busy}
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
              <IconFileImage size={17} /> Adjuntar referencia
            </label>
            <Button tone="primary" disabled={!hasKey || !prompt.trim() || busy} onClick={generate}>
              <IconSparkle size={16} /> {busy ? 'Generando…' : 'Generar propuesta'}
            </Button>
          </>
        )
      }
    >
      <p className="muted modal-lede">Genera una propuesta editable respetando la estructura y los tokens del proyecto.</p>
      {!hasKey && (
        <div className="ai-pending">
          <IconSparkle size={20} />
          <div>
            <strong>Conexión de IA pendiente</strong>
            <p>
              Agrega tu clave de API de Anthropic en{' '}
              <a href={href('/settings')} onClick={close}>
                Ajustes
              </a>{' '}
              para habilitar generación por texto e imagen.
            </p>
          </div>
        </div>
      )}
      {!screen ? (
        <>
          <label className="field">
            <span className="field-label field-label-strong">¿Qué quieres crear o mejorar?</span>
            <textarea
              className="input ai-prompt"
              rows={5}
              autoFocus
              placeholder="Crea un flujo de transferencia con selección de destinatario, monto y confirmación…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && hasKey && prompt.trim() && !busy) generate();
              }}
            />
          </label>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => setPrompt(s)}>
                {s}
              </button>
            ))}
          </div>
          {image && (
            <span className="attach-chip">
              <img src={`data:${image.mediaType};base64,${image.data}`} alt="" />
              {image.name}
              <button type="button" className="link-btn" onClick={() => setImage(null)}>
                Quitar
              </button>
            </span>
          )}
        </>
      ) : (
        <div className="assistant-result">
          <div className="assistant-preview">
            <ScreenCanvas project={project} screen={screen} mode="light" scale={0.62} />
          </div>
          <div className="stack">
            <strong className="assistant-name">{screen.name}</strong>
            <p className="muted">{proposal?.rationale}</p>
            <p className="small muted">
              Usa {screen.blocks.filter((b) => b.componentId).length} de {screen.blocks.length} bloques desde componentes del sistema. Nada se aplica hasta que la agregues al flujo.
            </p>
          </div>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}
