// נקודת כניסה אחת לכל פעולות השרת: /functions/v1/api/<פעולה>.
// כל פעולה בקובץ משלה ב-routes/. הלקוח קורא דרך packages/db בלבד.
import { CORS, json } from '../_shared/context.ts';
import answerWillingness from './routes/answer-willingness.ts';
import channelSend from './routes/channel-send.ts';
import pairingAgreement from './routes/pairing-agreement.ts';
import pairingFreeze from './routes/pairing-freeze.ts';
import pairingInvite from './routes/pairing-invite.ts';
import pairingJoin from './routes/pairing-join.ts';
import pairingUnpair from './routes/pairing-unpair.ts';
import revealSession from './routes/reveal-session.ts';
import saveDebrief from './routes/save-debrief.ts';
import saveScreening from './routes/save-screening.ts';
import sparkReply from './routes/spark-reply.ts';
import sparkSend from './routes/spark-send.ts';

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  'answer-willingness': answerWillingness,
  'channel-send': channelSend,
  'pairing-agreement': pairingAgreement,
  'pairing-freeze': pairingFreeze,
  'pairing-invite': pairingInvite,
  'pairing-join': pairingJoin,
  'pairing-unpair': pairingUnpair,
  'reveal-session': revealSession,
  'save-debrief': saveDebrief,
  'save-screening': saveScreening,
  'spark-reply': sparkReply,
  'spark-send': sparkSend,
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const name = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
  const route = ROUTES[name];
  return route ? route(req) : json({ error: 'not_found' }, 404);
});
