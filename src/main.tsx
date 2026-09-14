import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker, restoreInstalledStudy } from './lib/pwa';
import { completeAccessLink, isAccessLink } from './lib/cloud';
import { setCloudAccountCache } from './components/useCloudAccount';
import { notify } from './lib/toast';
import './styles.css';

restoreInstalledStudy();
registerServiceWorker();

// Enlace de acceso a la nube (llega por correo): termina de conectar y lleva a Ajustes.
if (isAccessLink()) {
  completeAccessLink()
    .then((account) => {
      setCloudAccountCache(account);
      notify(`Nube conectada con ${account.email}. Las sesiones de tus estudios llegarán solas.`, 'success');
    })
    .catch((e: Error) => notify(e.message || 'No pudimos conectar la nube. Pide un enlace nuevo desde Ajustes.', 'error'))
    .finally(() => {
      history.replaceState(null, '', `${location.pathname}#/settings`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
