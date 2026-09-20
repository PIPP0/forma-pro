import { useState } from 'react';
import { currentUser, exportWorkspace, importWorkspace, resetWorkspace, useDb } from '../lib/store';
import { AI_MODEL, getAiKey, setAiKey } from '../lib/ai';
import { download } from '../lib/share';
import { notify } from '../lib/toast';
import { go } from '../lib/router';
import { Badge, Button, Field, Modal, pickFile } from '../components/ui';
import { disconnectCloud, sendAccessLink } from '../lib/cloud';
import { getFigmaToken, setFigmaToken } from '../lib/figma';
import { setCloudAccountCache, useCloudAccount } from '../components/useCloudAccount';

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

      <CloudSection email={user?.email ?? ''} />

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

      <FigmaSection />

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
          Forma Pro corre en el navegador: proyectos, versiones y análisis viven aquí. Con la nube conectada, las sesiones y grabaciones de las pruebas remotas llegan solas. La colaboración en vivo entre personas todavía no está disponible.
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

function FigmaSection() {
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(!!getFigmaToken());

  return (
    <section className="section">
      <h2 className="section-title">Figma</h2>
      <p className="muted">
        Con un token personal de lectura puedes traer un flujo de Figma como pantallas. El token se guarda solo en este navegador, se usa únicamente contra api.figma.com y no se incluye en los
        respaldos.
      </p>
      <div className="row">{saved ? <Badge tone="ok">Token configurado</Badge> : <Badge>Sin token</Badge>}</div>
      <form
        className="row add-row"
        onSubmit={(e) => {
          e.preventDefault();
          const t = token.trim();
          if (t.length < 20) return notify('Ese token se ve incompleto. Cópialo entero desde Figma.', 'error');
          setFigmaToken(t);
          setToken('');
          setSaved(true);
          notify('Guardaste tu token de Figma en este navegador.', 'success');
        }}
      >
        <input
          className="input grow"
          type="password"
          autoComplete="off"
          aria-label="Token personal de Figma"
          placeholder={saved ? 'Reemplazar token' : 'Pega aquí tu token de Figma'}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button tone="primary" type="submit">
          Guardar token
        </Button>
        {saved && (
          <Button
            tone="ghost"
            onClick={() => {
              setFigmaToken('');
              setSaved(false);
              notify('Quitaste el token de Figma.', 'success');
            }}
          >
            Quitar token
          </Button>
        )}
      </form>
      <p className="small muted">Se crea en Figma → Settings → Security → Personal access tokens, con permiso de solo lectura de archivos.</p>
    </section>
  );
}

function CloudSection({ email }: { email: string }) {
  const { account, loading } = useCloudAccount();
  const [to, setTo] = useState(email);
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <section className="section">
      <h2 className="section-title">Resultados en la nube</h2>
      <p className="muted">
        Las sesiones de quienes participan desde el enlace llegan solas a Resultados, con su grabación de audio. Solo tú puedes verlas y escucharlas; quienes participan no necesitan cuenta.
      </p>
      {loading ? (
        <p className="muted small">Revisando la conexión…</p>
      ) : !account ? (
        <p className="muted small">Sin conexión con la nube. Los enlaces y resultados se sincronizan al volver a conectarte.</p>
      ) : account.email ? (
        <div className="row">
          <Badge tone="ok">Acceso guardado con {account.email}</Badge>
          <Button
            tone="ghost"
            onClick={async () => {
              await disconnectCloud().catch(() => undefined);
              setCloudAccountCache(null);
              notify('Cerraste el acceso en este navegador. Para volver a ver tus resultados, entra de nuevo con tu correo.', 'success');
            }}
          >
            Cerrar acceso
          </Button>
        </div>
      ) : (
        <p className="muted small">Activa en este navegador. Guarda tu acceso con tu correo para no perder tus resultados si borras los datos del navegador o cambias de equipo.</p>
      )}
      {account && !account.email && (
        <form
          className="row add-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const clean = to.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return notify('Escribe un correo válido.', 'error');
            setBusy(true);
            try {
              await sendAccessLink(clean);
              setSentTo(clean);
            } catch {
              notify('No pudimos enviar el enlace. Revisa el correo y tu conexión.', 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <input className="input grow" type="email" aria-label="Correo para conectar la nube" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button tone="primary" type="submit" disabled={busy}>
            {busy ? 'Enviando…' : 'Guardar mi acceso'}
          </Button>
        </form>
      )}
      {sentTo && !account?.email && <p className="small">Te enviamos un enlace a {sentTo}. Ábrelo en este mismo navegador para terminar de conectar. Si no llega en un par de minutos, revisa la carpeta de spam.</p>}
    </section>
  );
}
