const SUPABASE_URL = 'https://eqolnqnsyomgybyrtrzt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_koTIgLL07Qe1Wf-ZY81LCA_0UO310ks';

const BELVO_SCOPES = [
  'read_institutions',
  'write_links',
  'read_consents',
  'write_consents',
  'write_consent_callback',
  'delete_consents',
].join(',');

const FETCH_RESOURCES = ['ACCOUNTS', 'TRANSACTIONS', 'OWNERS', 'BILLS'];
const APP_URL = 'https://controle-financeiro-nine-kohl.vercel.app';

function sendJson(response, status, body) {
  response.status(status);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  return response.json(body);
}

function belvoBaseUrl(environment) {
  const normalized = String(environment || '').trim().toLowerCase();

  if (['production', 'prod', 'live'].includes(normalized)) {
    return 'https://api.belvo.com';
  }

  if (['sandbox', 'test', 'development', 'dev'].includes(normalized)) {
    return 'https://sandbox.belvo.com';
  }

  return null;
}

function isValidCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

async function getAuthenticatedUser(authorization) {
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
    },
  });

  if (!authResponse.ok) return null;
  const user = await authResponse.json();
  return user?.id ? user : null;
}

function sanitizeBelvoError(payload) {
  const errors = Array.isArray(payload) ? payload : [payload];
  return errors.filter(Boolean).slice(0, 5).map((error) => ({
    code: error.code || undefined,
    field: error.field || undefined,
    message: error.message || error.detail || 'Belvo recusou a solicitação.',
    requestId: error.request_id || undefined,
  }));
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'method_not_allowed' });
  }

  const authorization = request.headers.authorization;
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return sendJson(response, 401, { error: 'authentication_required' });
  }

  let user;
  try {
    user = await getAuthenticatedUser(authorization);
  } catch {
    return sendJson(response, 503, { error: 'authentication_service_unavailable' });
  }

  if (!user) {
    return sendJson(response, 401, { error: 'invalid_or_expired_session' });
  }

  const cpf = String(request.body?.cpf || '').replace(/\D/g, '');
  const name = String(request.body?.name || '').trim().replace(/\s+/g, ' ');

  if (!isValidCpf(cpf)) {
    return sendJson(response, 400, { error: 'invalid_cpf' });
  }

  if (name.length < 3 || name.length > 150) {
    return sendJson(response, 400, { error: 'invalid_name' });
  }

  const secretId = process.env.BELVO_SECRET_ID;
  const secretPassword = process.env.BELVO_SECRET_PASSWORD;
  const baseUrl = belvoBaseUrl(process.env.BELVO_ENV);

  if (!secretId || !secretPassword || !baseUrl) {
    return sendJson(response, 500, { error: 'belvo_not_configured' });
  }

  const payload = {
    id: secretId,
    password: secretPassword,
    scopes: BELVO_SCOPES,
    stale_in: '365d',
    fetch_resources: FETCH_RESOURCES,
    widget: {
      purpose: 'Organização e análise das suas informações financeiras pessoais.',
      openfinance_feature: 'consent_link_creation',
      callback_urls: {
        success: `${APP_URL}/?belvo=success`,
        exit: `${APP_URL}/?belvo=exit`,
        event: `${APP_URL}/?belvo=event`,
      },
      consent: {
        terms_and_conditions_url: APP_URL,
        permissions: ['REGISTER', 'ACCOUNTS', 'CREDIT_CARDS', 'CREDIT_OPERATIONS'],
        identification_info: [{ type: 'CPF', number: cpf, name }],
      },
    },
  };

  let belvoResponse;
  let belvoPayload;

  try {
    belvoResponse = await fetch(`${baseUrl}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    belvoPayload = await belvoResponse.json();
  } catch {
    return sendJson(response, 502, { error: 'belvo_unavailable' });
  }

  if (!belvoResponse.ok || !belvoPayload?.access) {
    return sendJson(response, 502, {
      error: 'belvo_token_failed',
      details: sanitizeBelvoError(belvoPayload),
    });
  }

  return sendJson(response, 200, { access: belvoPayload.access });
};
