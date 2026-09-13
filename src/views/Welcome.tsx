import { useMemo, useState } from 'react';
import { signIn } from '../lib/store';
import { transferProject } from '../lib/seed';
import { Runner } from '../components/Runner';
import { Button, Field } from '../components/ui';

export function Welcome() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const demo = useMemo(() => transferProject('demo', 'Demo'), []);

  return (
    <div className="welcome">
      <section className="welcome-left">
        <div>
          <h1 className="welcome-mark">Forma</h1>
          <p className="welcome-lede">El bloque que diseñas es el mismo que pruebas con una persona real y el mismo que mides en resultados.</p>
          <dl className="welcome-points">
            <div>
              <dt>Sistema</dt>
              <dd>Tokens para modo claro y oscuro, y componentes con sus cinco estados resueltos.</dd>
            </div>
            <div>
              <dt>Prototipo</dt>
              <dd>Pantallas por dispositivo y un guardarraíl que revisa flujo y contraste antes de compartir.</dd>
            </div>
            <div>
              <dt>Pruebas</dt>
              <dd>Enlace sin cuenta, consentimiento explícito y hallazgos con cita a cada sesión.</dd>
            </div>
          </dl>
        </div>
        <form
          className="welcome-form"
          onSubmit={(e) => {
            e.preventDefault();
            signIn(name, email);
          }}
        >
          <h2>Entra a tu espacio de trabajo</h2>
          <Field label="Tu nombre">
            <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Correo" hint="Define tus proyectos y tu rol. Todo se guarda en este navegador.">
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button tone="primary" type="submit">
            Entrar
          </Button>
        </form>
      </section>
      <aside className="welcome-right" aria-label="Prototipo de ejemplo">
        <div className="welcome-demo">
          <Runner project={demo} startScreenId="s-inicio" breakpoint="mobile" mode="light" maxScale={0.8} />
          <p className="welcome-demo-cap">Este prototipo está hecho en Forma y funciona. Prueba transferirle dinero a Martina.</p>
        </div>
      </aside>
    </div>
  );
}
