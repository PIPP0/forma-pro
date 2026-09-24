import { useMemo, useState } from 'react';
import { entrarComoCuenta } from '../lib/store';
import { sendAccessLink } from '../lib/cloud';
import { notify } from '../lib/toast';
import { transferProject } from '../lib/seed';
import { Runner } from '../components/Runner';
import { Button, Field } from '../components/ui';
import { BrandLockup } from '../components/Shell';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Welcome({ seguirComo, onSeguirLocal }: { seguirComo?: string; onSeguirLocal?: () => void } = {}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState('');
  const demo = useMemo(() => transferProject('demo'), []);

  const emailError = tried && !EMAIL.test(email.trim()) ? 'Escribe un correo con formato válido, por ejemplo nombre@empresa.cl.' : '';

  /** Entrar de verdad: el enlace conecta este navegador con tus proyectos, estén donde estén. */
  const entrar = async () => {
    setTried(true);
    const correo = email.trim().toLowerCase();
    if (!EMAIL.test(correo)) return;
    setEnviando(true);
    try {
      await sendAccessLink(correo);
      setEnviado(correo);
    } catch {
      notify('No pudimos enviar el enlace. Revisa tu conexión e inténtalo de nuevo.', 'error');
    } finally {
      setEnviando(false);
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
                Enviamos un enlace de acceso a <strong>{enviado}</strong>. Ábrelo en este navegador y entrarás con tus proyectos, vengas del computador que vengas.
              </p>
              <p className="muted small">¿No llega? Revisa la carpeta de no deseados o vuelve a intentarlo en un minuto.</p>
              <Button onClick={() => setEnviado('')}>Usar otro correo</Button>
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
              <Field
                label="Tu correo"
                hint={emailError ? <span className="field-error">{emailError}</span> : 'Te enviamos un enlace para entrar. Sin contraseña, y tus proyectos te siguen a cualquier computador.'}
              >
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.cl" aria-invalid={!!emailError} autoFocus />
              </Field>
              <Button tone="primary" type="submit" disabled={enviando}>
                {enviando ? 'Enviando el enlace…' : 'Entrar con mi correo'}
              </Button>
              <details className="welcome-local">
                <summary>{seguirComo ? `Seguir trabajando solo en este navegador` : 'Probar sin cuenta, solo en este navegador'}</summary>
                <p className="muted small">
                  Podrás diseñar y correr pruebas, pero lo que hagas se queda aquí: no viaja a otros equipos ni se recupera si borras los datos del navegador.
                </p>
                {seguirComo ? (
                  <Button onClick={() => onSeguirLocal?.()}>Seguir como {seguirComo}</Button>
                ) : (
                  <div className="row">
                    <input aria-label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
                    <Button
                      onClick={() => {
                        const correo = email.trim().toLowerCase();
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
          <span className="frame-label-text"># 01 — Inicio</span>
          <Runner project={demo} startScreenId="s-inicio" breakpoint="mobile" mode="light" maxScale={0.78} />
          <p className="welcome-demo-cap">Prototipo real hecho con Forma. Tócalo y crea una meta de ahorro.</p>
        </div>
      </aside>
    </div>
  );
}
