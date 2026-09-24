import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker, restoreInstalledStudy } from './lib/pwa';
import { completeAccessLink, isAccessLink } from './lib/cloud';
import { setCloudAccountCache } from './components/useCloudAccount';
import { entrarComoCuenta } from './lib/store';
import { olvidarPreferencia } from './lib/session';
import { notify } from './lib/toast';
import './styles.css';

restoreInstalledStudy();
registerServiceWorker();

// Enlace de acceso a la nube (llega por correo): termina de conectar y lleva a Ajustes.
if (isAccessLink()) {
  completeAccessLink()
    .then((account) => {
      // Entrar con un correo es entrar de verdad: la sesión local pasa a ser esa cuenta, y con
      // ella llegan sus proyectos. Si no, quedarías dentro con otra identidad y verías otra cosa.
      if (account.email) {
        entrarComoCuenta(account.email);
        olvidarPreferencia();
      }
      setCloudAccountCache(account);
      notify(`Entraste como ${account.email}. Estamos trayendo tus proyectos…`, 'success');
    })
    .catch((e: Error) => notify(e.message || 'No pudimos conectar la nube. Pide un enlace nuevo desde Ajustes.', 'error'))
    .finally(() => {
      history.replaceState(null, '', `${location.pathname}#/`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
