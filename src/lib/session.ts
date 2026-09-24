// Quién entra y cómo: la elección se recuerda en este navegador, no viaja a ninguna parte.
const CLAVE = 'formapro.sincuenta';

/** Alguien decidió trabajar solo aquí: no hay que volver a preguntarle en cada visita. */
export const prefiereLocal = () => {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
};

export const quedarseLocal = () => {
  try {
    localStorage.setItem(CLAVE, '1');
  } catch {
    /* sin almacenamiento */
  }
};

/** Al entrar con correo, la preferencia deja de tener sentido. */
export const olvidarPreferencia = () => {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento */
  }
};
