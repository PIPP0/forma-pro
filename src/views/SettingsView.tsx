import { useState } from 'react';
import { currentUser, exportWorkspace, importWorkspace, resetWorkspace, useDb } from '../lib/store';
import { AI_MODEL, getAiKey, setAiKey } from '../lib/ai';
import { download } from '../lib/share';
import { notify } from '../lib/toast';
import { go } from '../lib/router';
import { Badge, Button, Field, Modal, pickFile } from '../components/ui';

export function SettingsView() {
  const db = useDb();
  const user = currentUser(db);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(!!getAiKey());
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <p className="page-sub">
            Sesión de {user?.name} ({user?.email}).
          </p>
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">Inteligencia artificial</h2>
        <p className="muted">
          El copiloto y el resumen de investigación usan la API de Anthropic con el modelo <code>{AI_MODEL}</code>. La clave se guarda solo en este navegador y se envía únicamente a api.anthropic.com. No se incluye en los respaldos.
        </p>
        <div className="row">
          {hasKey ? <Badge tone="ok">Clave configurada</Badge> : <Badge>Sin clave</Badge>}
        </div>
        <form
          className="row add-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!key.trim().startsWith('sk-')) return notify('La clave de API de Anthropic empieza con «sk-».', 'error');
            setAiKey(key.trim());
            setKey('');
            setHasKey(true);
            notify('Guardaste la clave de API en este navegador.', 'success');
          }}
        >
          <input className="input grow" type="password" autoComplete="off" aria-label="Clave de API de Anthropic" placeholder={hasKey ? 'Reemplazar clave' : 'Pega aquí tu clave de API'} value={key} onChange={(e) => setKey(e.target.value)} />
          <Button tone="primary" type="submit">
            Guardar clave
          </Button>
          {hasKey && (
            <Button
              tone="ghost"
              onClick={() => {
                setAiKey('');
                setHasKey(false);
                notify('Quitaste la clave de API.', 'success');
              }}
            >
              Quitar clave
            </Button>
          )}
        </form>
      </section>

      <section className="section">
        <h2 className="section-title">Respaldo del espacio de trabajo</h2>
        <p className="muted">Tus proyectos, versiones, estudios y resultados viven en este navegador. Exporta un respaldo para moverlos a otro equipo o guardarlos.</p>
        <div className="row">
          <Button onClick={() => download(`forma-respaldo-${new Date().toISOString().slice(0, 10)}.json`, exportWorkspace())}>Exportar respaldo</Button>
          <Button
            onClick={async () => {
              const t = await pickFile('.json');
              if (t) setPendingImport(t);
            }}
          >
            Importar respaldo
          </Button>
          <Button tone="danger" onClick={() => setConfirmReset(true)}>
            Borrar todos los datos
          </Button>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Sobre esta versión</h2>
        <p className="muted">
          Forma Pro corre completo en el navegador: el modelo de datos, el guardado por operación, los permisos y el análisis de estudios son los mismos que usará el servidor. Lo que necesita backend para funcionar entre personas y dispositivos (acceso por correo con código, sesiones de prueba que llegan solas, colaboración en vivo) está descrito en el README del repositorio.
        </p>
      </section>

      <Modal
        open={!!pendingImport}
        title="Importar respaldo"
        onClose={() => setPendingImport(null)}
        footer={
          <>
            <Button onClick={() => setPendingImport(null)}>Cancelar</Button>
            <Button
              tone="primary"
              onClick={() => {
                if (pendingImport && importWorkspace(pendingImport)) {
                  setPendingImport(null);
                  go('/');
                }
              }}
            >
              Reemplazar con el respaldo
            </Button>
          </>
        }
      >
        <p>El respaldo reemplaza todos los datos actuales de este navegador. Exporta primero si quieres conservarlos.</p>
      </Modal>

      <Modal
        open={confirmReset}
        title="Borrar todos los datos"
        onClose={() => setConfirmReset(false)}
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancelar</Button>
            <Button
              tone="danger"
              onClick={() => {
                resetWorkspace();
                setConfirmReset(false);
                go('/');
              }}
            >
              Borrar todo
            </Button>
          </>
        }
      >
        <p>Se eliminarán perfiles, proyectos, versiones, estudios y resultados de este navegador. No se puede deshacer.</p>
      </Modal>
    </div>
  );
}
