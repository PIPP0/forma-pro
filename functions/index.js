// Proxy de IA para Forma Pro: la clave de Anthropic vive aquí, no en el navegador.
// Así la IA funciona en cualquier equipo con solo iniciar sesión, y nadie ve la clave.
//
// config/ia (Firestore, solo lectura desde el servidor)
//   correos: ['persona@dominio.cl', …]   quiénes pueden usarla
//   topeUsuarioClp: número               gasto máximo por persona y mes, en pesos
//   topeTotalClp: número                 gasto máximo del proyecto por mes, en pesos
//   clpPorUsd: número                    cambio con el que se convierte el costo real de la API
// iaUso/{uid}_{YYYYMM}                   consumo real medido, para la cuota y para mostrarlo en Ajustes
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import Anthropic from '@anthropic-ai/sdk';

initializeApp();

const secretos = new SecretManagerServiceClient();
const RUTA_CLAVE = 'projects/forma-pro-cl26/secrets/ANTHROPIC_API_KEY/versions/latest';
let clave = { valor: '', hasta: 0 };

/**
 * La clave se lee de Secret Manager en caliente, no como variable de entorno:
 * cargar una versión nueva basta para que empiece a funcionar, sin volver a desplegar.
 */
async function claveAnthropic() {
  if (clave.valor && Date.now() < clave.hasta) return clave.valor;
  const [version] = await secretos.accessSecretVersion({ name: RUTA_CLAVE });
  const valor = (version.payload?.data?.toString('utf8') ?? '').trim();
  if (!valor) throw new Error('secreto vacío');
  clave = { valor, hasta: Date.now() + 5 * 60 * 1000 };
  return valor;
}

/** Modelos permitidos y su precio por millón de tokens. Nadie puede pedir otro desde el cliente. */
const MODELOS = {
  'claude-haiku-4-5': { entrada: 1, salida: 5, piensa: false },
  'claude-sonnet-5': { entrada: 2, salida: 10, piensa: true },
};

const ORIGENES = ['https://pipp0.github.io', 'http://localhost:5188', 'http://localhost:5173'];

/** Topes por defecto en pesos, si nadie configuró config/ia. Prudentes a propósito. */
const TOPE_USUARIO = 5000;
const TOPE_TOTAL = 5000;
/** La API se factura en dólares; el tope se controla en pesos. Cambio conservador y configurable. */
const CLP_POR_USD = 1000;

const mesActual = () => new Date().toISOString().slice(0, 7).replace('-', '');

function cors(req, res) {
  const origen = req.headers.origin;
  if (origen && ORIGENES.includes(origen)) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'X-Forma-Token, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

/**
 * Quién llama: solo cuentas con correo verificado, nunca las anónimas de los participantes.
 * El token viaja en una cabecera propia porque Cloud Run intercepta «Authorization» y rechaza
 * cualquier token que no sea de Google antes de que la petición llegue hasta acá.
 */
async function identificar(req) {
  const token = String(req.headers['x-forma-token'] ?? '');
  if (!token) return { error: 'Inicia sesión con tu correo para usar la IA del equipo.', code: 401 };
  try {
    const claims = await getAuth().verifyIdToken(token);
    if (claims.firebase?.sign_in_provider === 'anonymous' || !claims.email)
      return { error: 'Guarda tu acceso con correo en Ajustes: la IA del equipo no está disponible para cuentas anónimas.', code: 403 };
    return { uid: claims.uid, email: String(claims.email).toLowerCase() };
  } catch {
    return { error: 'Tu sesión expiró. Vuelve a entrar y reintenta.', code: 401 };
  }
}

export const ia = onRequest(
  { region: 'southamerica-west1', timeoutSeconds: 300, memory: '512MiB', maxInstances: 10, cors: false },
  async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

    const quien = await identificar(req);
    if (quien.error) return res.status(quien.code).json({ error: quien.error });

    const db = getFirestore();
    const conf = (await db.doc('config/ia').get()).data() ?? {};
    const correos = (conf.correos ?? []).map((c) => String(c).toLowerCase());
    if (!correos.includes(quien.email))
      return res.status(403).json({ error: `${quien.email} no está en la lista de personas autorizadas para usar la IA. Pide que te agreguen.` });

    const cambio = Number(conf.clpPorUsd ?? CLP_POR_USD);
    const topeUsuario = Number(conf.topeUsuarioClp ?? TOPE_USUARIO);
    const topeTotal = Number(conf.topeTotalClp ?? TOPE_TOTAL);
    const mes = mesActual();
    const usoRef = db.doc(`iaUso/${quien.uid}_${mes}`);
    const totalRef = db.doc(`iaUso/_total_${mes}`);
    const [usoSnap, totalSnap] = await Promise.all([usoRef.get(), totalRef.get()]);
    const gastado = Number(usoSnap.data()?.usd ?? 0) * cambio;
    const gastadoTotal = Number(totalSnap.data()?.usd ?? 0) * cambio;
    if (gastado >= topeUsuario)
      return res.status(429).json({ error: `Alcanzaste tu tope mensual de IA ($${Math.round(topeUsuario).toLocaleString('es-CL')}). Se renueva el día 1 del próximo mes.` });
    if (gastadoTotal >= topeTotal)
      return res.status(429).json({ error: `El equipo alcanzó su tope mensual de IA ($${Math.round(topeTotal).toLocaleString('es-CL')}). Habla con quien administra el espacio de trabajo.` });

    const { model, system, messages, schema } = req.body ?? {};
    const perfil = MODELOS[model];
    if (!perfil) return res.status(400).json({ error: 'Modelo no permitido.' });
    if (typeof system !== 'string' || !Array.isArray(messages) || !messages.length || typeof schema !== 'object')
      return res.status(400).json({ error: 'Petición mal formada.' });

    try {
      const anthropic = new Anthropic({ apiKey: await claveAnthropic() });
      const stream = anthropic.beta.messages.stream({
        model,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        ...(perfil.piensa ? { thinking: { type: 'adaptive' } } : {}),
        output_config: { format: { type: 'json_schema', schema } },
        system,
        messages,
      });
      const respuesta = await stream.finalMessage();
      const entrada = respuesta.usage?.input_tokens ?? 0;
      const salida = (respuesta.usage?.output_tokens ?? 0) + (respuesta.usage?.cache_creation_input_tokens ?? 0);
      const usd = (entrada / 1e6) * perfil.entrada + (salida / 1e6) * perfil.salida;

      // El consumo se anota siempre, aunque la respuesta venga incompleta: ya se pagó.
      const anotar = { entrada: FieldValue.increment(entrada), salida: FieldValue.increment(salida), usd: FieldValue.increment(usd), llamadas: FieldValue.increment(1), mes, actualizado: FieldValue.serverTimestamp() };
      await Promise.all([usoRef.set({ ...anotar, uid: quien.uid, email: quien.email }, { merge: true }), totalRef.set(anotar, { merge: true })]);

      if (respuesta.stop_reason === 'refusal') return res.status(422).json({ error: 'El modelo no pudo responder esta solicitud. Reformúlala e intenta de nuevo.' });
      if (respuesta.stop_reason === 'max_tokens') return res.status(422).json({ error: 'La respuesta quedó incompleta. Intenta con una solicitud más acotada.' });

      const text = respuesta.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return res.json({ text, usage: { entrada, salida, clp: usd * cambio, gastadoMes: gastado + usd * cambio, topeUsuario } });
    } catch (e) {
      if (e?.message === 'secreto vacío' || e?.code === 5)
        return res.status(503).json({ error: 'La IA del equipo todavía no tiene su clave cargada. Avisa a quien administra el espacio de trabajo.' });
      const status = e?.status;
      if (status === 401) return res.status(500).json({ error: 'La clave de API del equipo no es válida. Avisa a quien administra el espacio de trabajo.' });
      if (status === 429) return res.status(429).json({ error: 'La API está al límite de uso en este momento. Espera un poco e intenta de nuevo.' });
      console.error('fallo al llamar a Anthropic', e);
      return res.status(502).json({ error: 'No pudimos completar la consulta a la IA. Intenta de nuevo.' });
    }
  },
);

/** Consumo del mes de quien pregunta, para mostrarlo en Ajustes. */
export const iaUso = onRequest({ region: 'southamerica-west1', maxInstances: 5, cors: false }, async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  const quien = await identificar(req);
  if (quien.error) return res.status(quien.code).json({ error: quien.error });

  const db = getFirestore();
  const mes = mesActual();
  const [conf, uso] = await Promise.all([db.doc('config/ia').get(), db.doc(`iaUso/${quien.uid}_${mes}`).get()]);
  const correos = (conf.data()?.correos ?? []).map((c) => String(c).toLowerCase());
  const cambio = Number(conf.data()?.clpPorUsd ?? CLP_POR_USD);
  return res.json({
    autorizado: correos.includes(quien.email),
    clp: Number(uso.data()?.usd ?? 0) * cambio,
    llamadas: Number(uso.data()?.llamadas ?? 0),
    topeUsuario: Number(conf.data()?.topeUsuarioClp ?? TOPE_USUARIO),
    mes,
  });
});
