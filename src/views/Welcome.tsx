import { useMemo, useState } from 'react';
import { entrarComoCuenta } from '../lib/store';
import { enviarCambioDePassword, entrarConPassword, sendAccessLink } from '../lib/cloud';
import { setCloudAccountCache } from '../components/useCloudAccount';
import { olvidarPreferencia } from '../lib/session';
import { notify } from '../lib/toast';
import { transferProject } from '../lib/seed';
import { Runner } from '../components/Runner';
import { Button, Field } from '../components/ui';
import { BrandLockup } from '../components/Shell';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Welcome({ seguirComo, onSeguirLocal }: { seguirComo?: string; onSeguirLocal?: () => void } = {}) {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState('');
  const demo = useMemo(() => transferProject('demo'), []);

  const correo = email.trim().toLowerCase();
  const emailError = tried && !EMAIL.test(correo) ? 'Escribe un correo con formato válido, por ejemplo nombre@empresa.cl.' : '';
  const claveError = tried && clave.length < 6 ? 'La contraseña debe tener al menos 6 caracteres.' : '';

  const entrar = async () => {
    setTried(true);
    setError('');
    if (!EMAIL.test(correo) || clave.length < 6) return;
    setEntrando(true);
    try {
      const cuenta = await entrarConPassword(correo, clave);
      entrarComoCuenta(cuenta.email ?? correo, name, cuenta.veniaSinCuenta);
      olvidarPreferencia();
      setCloudAccountCache(cuenta);
      setClave('');
      notify(`Entraste como ${cuenta.email}. Estamos trayendo tus proyectos…`, 'success');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEntrando(false);
    }
  };

  /** Camino alternativo, para quien no recuerda su contraseña o prefiere no usarla. */
  const porCorreo = async (tipo: 'enlace' | 'cambio') => {
    setTried(true);
    if (!EMAIL.test(correo)) return;
    setError('');
    try {
      if (tipo === 'enlace') await sendAccessLink(correo);
      else await enviarCambioDePassword(correo);
      setEnviado(correo);
    } catch {
      setError('No pudimos enviar el correo. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  return (
    <div className="welcome">
      <section className="welcome-left">
        <BrandLockup />
        <div className="welcome-body">
          <h1 className="welcome-title">Diseña, prueba y entrega en un solo lugar.</h1>
          <p className="welcome-lede">El bloque que diseñas es el mismo que pruebas con una persona real y el mismo que mides en resultados.</p>

          {enviado ? (
            <div className="welcome-enviado">
              <h2>Revisa tu correo</h2>
              <p>
                Te escribimos a <strong>{enviado}</strong>. Abre el enlace en este navegador: según lo que pediste, entrarás directamente o podrás definir tu contraseña.
              </p>
              <p className="muted small">¿No llega? Revisa la carpeta de no deseados o inténtalo de nuevo en un minuto.</p>
              <Button onClick={() => setEnviado('')}>Volver</Button>
            </div>
          ) : (
            <form
              className="welcome-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void entrar();
              }}
            >
              <Field label="Tu correo" hint={emailError && <span className="field-error">{emailError}</span>}>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.cl" aria-invalid={!!emailError} autoFocus />
              </Field>
              <Field
                label="Contraseña"
                hint={claveError ? <span className="field-error">{claveError}</span> : 'Si el correo es nuevo, la contraseña que escribas será la suya.'}
              >
                <input type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Al menos 6 caracteres" aria-invalid={!!claveError} />
              </Field>
              {error && (
                <div className="notice notice-err welcome-error">
                  <span>{error}</span>
                  <Button size="sm" onClick={() => void porCorreo('cambio')}>
                    Crear contraseña
                  </Button>
                </div>
              )}
              <Button tone="primary" type="submit" disabled={entrando}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </Button>
              <p className="welcome-otras">
                <button type="button" className="link-btn" onClick={() => void porCorreo('cambio')}>
                  Crear o recuperar contraseña
                </button>
                <span aria-hidden="true">·</span>
                <button type="button" className="link-btn" onClick={() => void porCorreo('enlace')}>
                  Entrar con un enlace por correo
                </button>
              </p>
              <details className="welcome-local">
                <summary>{seguirComo ? 'Seguir trabajando solo en este navegador' : 'Probar sin cuenta, solo en este navegador'}</summary>
                <p className="muted small">Podrás diseñar y correr pruebas, pero lo que hagas se queda aquí: no viaja a otros equipos ni se recupera si borras los datos del navegador.</p>
                {seguirComo ? (
                  <Button onClick={() => onSeguirLocal?.()}>Seguir como {seguirComo}</Button>
                ) : (
                  <div className="row">
                    <input aria-label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
                    <Button
                      onClick={() => {
                        if (!EMAIL.test(correo)) return setTried(true);
                        if (entrarComoCuenta(correo, name)) onSeguirLocal?.();
                      }}
                    >
                      Entrar sin cuenta
                    </Button>
                  </div>
                )}
              </details>
            </form>
          )}
        </div>
        <p className="welcome-foot">Forma Studio · Tus proyectos viajan con tu correo</p>
      </section>
      <aside className="welcome-right" aria-label="Prototipo de ejemplo">
        <div className="welcome-demo">
          <span className="frame-label-text">Proyecto</span>
          <Runner project={demo} startScreenId="s-inicio" breakpoint="mobile" mode="light" maxScale={0.78} />
          <p className="welcome-demo-cap">Prototipo real hecho con Forma. Tócalo y crea una meta de ahorro.</p>
        </div>
      </aside>
    </div>
  );
}
