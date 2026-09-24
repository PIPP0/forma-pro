import { useEffect, useState } from 'react';
import { currentUser, exportWorkspace, importWorkspace, resetWorkspace, signOut, useDb } from '../lib/store';
import { AI_MODELS, consumoDeIa, getAiKey, setAiKey, type IaConsumo } from '../lib/ai';
import { download } from '../lib/share';
import { notify } from '../lib/toast';
import { go } from '../lib/router';
import { olvidarPreferencia } from '../lib/session';
import { Badge, Button, Field, Modal, pickFile, timeAgo } from '../components/ui';
import { disconnectCloud } from '../lib/cloud';
import { getFigmaToken, setFigmaToken } from '../lib/figma';
import { setCloudAccountCache, useCloudAccount } from '../components/useCloudAccount';
import { sincronizarAhora, useEstadoSync } from '../components/useSync';

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

      <CloudSection />

      <IaSection hasKey={hasKey} keyValue={key} setKeyValue={setKey} setHasKey={setHasKey} />

      <FigmaSection />

      <EspacioSection />

      <section className="section">
        <h2 className="section-title">Respaldo en archivo</h2>
        <p className="muted">Además de la nube, puedes guardar una copia completa en un archivo: sirve para archivar un momento del trabajo o para mover todo a otra cuenta.</p>
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

function CloudSection() {
  const { account, loading } = useCloudAccount();

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
        <div className="row">
          <Button
            tone="primary"
            onClick={() => {
              olvidarPreferencia();
              signOut();
            }}
          >
            Entrar con mi correo
          </Button>
          <span className="muted small">Te lleva a la pantalla de entrada. Con tu correo y contraseña, tus proyectos y resultados te siguen a cualquier computador.</span>
        </div>
      )}
      </section>
  );
}

/** Estado de la IA: la del equipo viaja con tu sesión; la propia, solo con este navegador. */
function IaSection({ hasKey, keyValue, setKeyValue, setHasKey }: { hasKey: boolean; keyValue: string; setKeyValue: (v: string) => void; setHasKey: (v: boolean) => void }) {
  const { account } = useCloudAccount();
  const [consumo, setConsumo] = useState<IaConsumo | null>(null);
  const [propia, setPropia] = useState(hasKey);

  useEffect(() => {
    let vivo = true;
    if (account?.email) consumoDeIa().then((c) => vivo && setConsumo(c)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [account?.email]);

  const equipo = !!account?.email && consumo?.autorizado;
  return (
    <section className="section">
      <h2 className="section-title">Inteligencia artificial</h2>
      <p className="muted">
        El asistente de diseño usa <code>{AI_MODELS.diseno}</code> y el resumen de investigación, <code>{AI_MODELS.analisis}</code>: cada tarea con el modelo que le corresponde, para no pagar de más.
      </p>
      <div className="row">
        {hasKey ? (
          <Badge tone="ok">Usando tu clave</Badge>
        ) : equipo ? (
          <Badge tone="ok">IA del equipo activa</Badge>
        ) : consumo && !consumo.autorizado ? (
          <Badge tone="warn">Tu correo no está autorizado</Badge>
        ) : (
          <Badge>Sin IA</Badge>
        )}
        {consumo && !hasKey && (
          <span className="muted small">
            Llevas ${Math.round(consumo.clp).toLocaleString('es-CL')} este mes en {consumo.llamadas} {consumo.llamadas === 1 ? 'consulta' : 'consultas'}, de un tope de $
            {consumo.topeUsuario.toLocaleString('es-CL')}.
          </span>
        )}
      </div>
      <p className="muted small">
        {equipo
          ? 'La clave vive en el proyecto en la nube, no en este navegador: la IA te sigue a cualquier equipo con solo iniciar sesión con tu correo.'
          : consumo && !consumo.autorizado
            ? 'Pide que agreguen tu correo a la lista de la IA del equipo, o usa tu propia clave aquí abajo.'
            : 'Guarda tu acceso con correo más arriba y la IA del equipo queda disponible en cualquier navegador. También puedes usar tu propia clave.'}
      </p>

      <details className="found-more" open={propia}>
        <summary onClick={() => setPropia((v) => !v)}>Usar mi propia clave en este navegador</summary>
        <p className="muted small">
          La clave se guarda solo aquí, se envía únicamente a api.anthropic.com y no se incluye en los respaldos. Mientras exista, tus consultas se cobran a tu cuenta y no a la del equipo.
        </p>
        <form
          className="row add-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!keyValue.trim().startsWith('sk-')) return notify('La clave de API de Anthropic empieza con «sk-».', 'error');
            setAiKey(keyValue.trim());
            setKeyValue('');
            setHasKey(true);
            notify('Guardaste la clave de API en este navegador.', 'success');
          }}
        >
          <input
            className="input grow"
            type="password"
            autoComplete="off"
            aria-label="Clave de API de Anthropic"
            placeholder={hasKey ? 'Reemplazar clave' : 'Pega aquí tu clave de API'}
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
          />
          <Button tone="primary" type="submit">
            Guardar clave
          </Button>
          {hasKey && (
            <Button
              tone="ghost"
              onClick={() => {
                setAiKey('');
                setHasKey(false);
                notify('Quitaste la clave de API. Vuelves a usar la IA del equipo.', 'success');
              }}
            >
              Quitar clave
            </Button>
          )}
        </form>
      </details>
    </section>
  );
}

/** Tu espacio en la nube: lo que hace que los proyectos estén en cualquier computador. */
function EspacioSection() {
  const { account } = useCloudAccount();
  const sync = useEstadoSync();
  const db = useDb();
  const proyectos = db.projects.length;
  const estudios = db.studies.length;

  return (
    <section className="section">
      <h2 className="section-title">Tu espacio en la nube</h2>
      {account?.email ? (
        <>
          <p className="muted">
            Tus {proyectos} {proyectos === 1 ? 'proyecto' : 'proyectos'} y {estudios} {estudios === 1 ? 'estudio' : 'estudios'} viajan con {account.email}. Entra con ese correo en cualquier computador o
            navegador y los encuentras ahí, con sus pantallas y sus resultados.
          </p>
          <div className="row">
            {sync.error ? <Badge tone="warn">Sin sincronizar</Badge> : sync.sincronizando ? <Badge>Sincronizando…</Badge> : <Badge tone="ok">Al día</Badge>}
            {sync.ultima && !sync.sincronizando && <span className="muted small">Última vez, {timeAgo(sync.ultima)}.</span>}
            <Button size="sm" disabled={sync.sincronizando} onClick={() => void sincronizarAhora(true)}>
              Sincronizar ahora
            </Button>
          </div>
          {sync.error && <p className="muted small">{sync.error}</p>}
          <p className="muted small">
            Si cambias un mismo proyecto en dos equipos sin sincronizar entremedio, queda la versión guardada más tarde. Las sesiones de las pruebas nunca se pierden: se juntan las de todos los equipos.
          </p>
        </>
      ) : (
        <p className="muted">
          Guarda tu acceso con correo más arriba y tus proyectos dejarán de vivir solo en este navegador: se sincronizan con tu cuenta y aparecen en cualquier computador donde entres con ese correo.
        </p>
      )}
    </section>
  );
}
