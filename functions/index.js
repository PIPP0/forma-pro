// Proxy de IA para Forma Pro: la clave de Anthropic vive aquí, no en el navegador.
// Así la IA funciona en cualquier equipo con solo iniciar sesión, y nadie ve la clave.
//
// config/ia (Firestore, solo lectura desde el servidor)
//   correos: ['persona@dominio.cl', …]   quiénes pueden usarla
//   topeUsuarioUsd: número               gasto máximo por persona y mes
//   topeTotalUsd: número                 gasto máximo del proyecto por mes
// iaUso/{uid}_{YYYYMM}                   consumo real medido, para la cuota y para mostrarlo en Ajustes
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';

const CLAVE = defineSecret('ANTHROPIC_API_KEY');

initializeApp();

/** Modelos permitidos y su precio por millón de tokens. Nadie puede pedir otro desde el cliente. */
const MODELOS = {
  'claude-haiku-4-5': { entrada: 1, salida: 5, piensa: false },
  'claude-sonnet-5': { entrada: 2, salida: 10, piensa: true },
};

const ORIGENES = ['https://pipp0.github.io', 'http://localhost:5188', 'http://localhost:5173'];

/** Topes por defecto si nadie configuró config/ia. Prudentes a propósito. */
const TOPE_USUARIO = 10;
const TOPE_TOTAL = 60;

const mesActual = () => new Date().toISOString().slice(0, 7).replace('-', '');

function cors(req, res) {
  const origen = req.headers.origin;
  if (origen && ORIGENES.includes(origen)) {
    res.set('Access-Control-Allow-Origin', origen);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

/** Quién llama: solo cuentas con correo verificado, nunca las anónimas de los participantes. */
async function identificar(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
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
  { region: 'southamerica-west1', secrets: [CLAVE], timeoutSeconds: 300, memory: '512MiB', maxInstances: 10, cors: false },
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

    const topeUsuario = Number(conf.topeUsuarioUsd ?? TOPE_USUARIO);
    const topeTotal = Number(conf.topeTotalUsd ?? TOPE_TOTAL);
    const mes = mesActual();
    const usoRef = db.doc(`iaUso/${quien.uid}_${mes}`);
    const totalRef = db.doc(`iaUso/_total_${mes}`);
    const [usoSnap, totalSnap] = await Promise.all([usoRef.get(), totalRef.get()]);
    const gastado = Number(usoSnap.data()?.usd ?? 0);
    const gastadoTotal = Number(totalSnap.data()?.usd ?? 0);
    if (gastado >= topeUsuario)
      return res.status(429).json({ error: `Alcanzaste tu tope mensual de IA (US$${topeUsuario}). Se renueva el día 1 del próximo mes.` });
    if (gastadoTotal >= topeTotal) return res.status(429).json({ error: 'El equipo alcanzó su tope mensual de IA. Habla con quien administra el espacio de trabajo.' });

    const { model, system, messages, schema } = req.body ?? {};
    const perfil = MODELOS[model];
    if (!perfil) return res.status(400).json({ error: 'Modelo no permitido.' });
    if (typeof system !== 'string' || !Array.isArray(messages) || !messages.length || typeof schema !== 'object')
      return res.status(400).json({ error: 'Petición mal formada.' });

    try {
      // El .trim() evita que un salto de línea al pegar la clave la invalide.
      const anthropic = new Anthropic({ apiKey: CLAVE.value().trim() });
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
      return res.json({ text, usage: { entrada, salida, usd, gastadoMes: gastado + usd, topeUsuario } });
    } catch (e) {
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
  return res.json({
    autorizado: correos.includes(quien.email),
    usd: Number(uso.data()?.usd ?? 0),
    llamadas: Number(uso.data()?.llamadas ?? 0),
    topeUsuario: Number(conf.data()?.topeUsuarioUsd ?? TOPE_USUARIO),
    mes,
  });
});
