import { useMemo, useState } from 'react';
import { signIn } from '../lib/store';
import { transferProject } from '../lib/seed';
import { Runner } from '../components/Runner';
import { Button, Field } from '../components/ui';
import { BrandLockup } from '../components/Shell';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Welcome() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const demo = useMemo(() => transferProject('demo'), []);

  const nameError = tried && !name.trim() ? 'Escribe tu nombre.' : '';
  const emailError = tried && !EMAIL.test(email.trim()) ? 'Escribe un correo con formato válido, por ejemplo demo@forma.cl.' : '';

  return (
    <div className="welcome">
      <section className="welcome-left">
        <BrandLockup />
        <div className="welcome-body">
          <h1 className="welcome-title">Diseña, prueba y entrega en un solo lugar.</h1>
          <p className="welcome-lede">El bloque que diseñas es el mismo que pruebas con una persona real y el mismo que mides en resultados.</p>
          <form
            className="welcome-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setTried(true);
              if (name.trim() && EMAIL.test(email.trim())) signIn(name, email);
            }}
          >
            <Field label="Tu nombre" hint={nameError && <span className="field-error">{nameError}</span>}>
              <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Francisca" aria-invalid={!!nameError} />
            </Field>
            <Field label="Correo" hint={emailError ? <span className="field-error">{emailError}</span> : 'Sin contraseña: tu correo identifica tus proyectos en este navegador.'}>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.cl" aria-invalid={!!emailError} />
            </Field>
            <Button tone="primary" type="submit">
              Entrar al workspace
            </Button>
          </form>
        </div>
        <p className="welcome-foot">Forma Studio · Tus datos se guardan en este navegador</p>
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
