const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT) || 3000;
const maxBodySize = 16 * 1024;
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL || 'Feedback System <onboarding@resend.dev>';
const configuredOrigins =
  process.env.FRONTEND_ORIGIN ||
  'https://rhonelcustodio.github.io,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5501';
const allowedOrigins = new Set(
  configuredOrigins
    .split(',')
    .map((origin) => {
      try {
        return new URL(origin.trim()).origin;
      } catch {
        throw new Error(`Invalid origin in FRONTEND_ORIGIN: ${origin}`);
      }
    })
    .filter(Boolean)
);

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (!origin) return true;

  if (!allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: 'Origin is not allowed' });
    return false;
  }

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Vary', 'Origin');
  return true;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBodySize) {
      throw new Error('Request body too large');
    }
  }
  return JSON.parse(body);
}

async function handleEmailRequest(request, response) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    const status = error.message === 'Request body too large' ? 413 : 400;
    sendJson(response, status, { error: status === 413 ? error.message : 'Invalid JSON body' });
    return;
  }

  const { userEmail, userRating, userComments } = body ?? {};
  if (
    typeof userEmail !== 'string' ||
    userEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail) ||
    typeof userRating !== 'string' ||
    !/^[1-5]\s*\/\s*5$/.test(userRating) ||
    typeof userComments !== 'string' ||
    !userComments.trim() ||
    userComments.length > 5000
  ) {
    sendJson(response, 400, { error: 'Invalid feedback details' });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured.');
    sendJson(response, 500, { error: 'Email service is not configured' });
    return;
  }

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: ['mprvtccntlocked@gmail.com'],
        reply_to: userEmail,
        subject: `New Feedback Received - Rating: ${userRating}`,
        html: `
          <h3>New Feedback Submission</h3>
          <p><strong>User Email:</strong> ${escapeHtml(userEmail)}</p>
          <p><strong>Rating:</strong> ${escapeHtml(userRating)}</p>
          <p><strong>Comments:</strong></p>
          <blockquote style="background: #f9f9f9; padding: 10px; border-left: 3px solid #ccc; margin-left: 0;">
            ${escapeHtml(userComments)}
          </blockquote>
          <hr />
          <p style="color:#898989;font-size:12px;">2261 Market Street #5039 - San Francisco, CA 94114</p>
        `,
        text: `New Feedback from ${userEmail}. Rating: ${userRating}. Comments: ${userComments}`,
      }),
    });

    const result = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error('Resend rejected the email request:', result);
      sendJson(response, 502, { error: 'Unable to send feedback' });
      return;
    }

    sendJson(response, 200, { success: true, data: result });
  } catch (error) {
    console.error('Failed to send feedback email:', error);
    sendJson(response, 502, { error: 'Unable to send feedback' });
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api/emails') {
    if (!applyCors(request, response)) return;

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }
    await handleEmailRequest(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), (error, content) => {
      if (error) {
        console.error('Failed to read index.html:', error);
        response.writeHead(500);
        response.end('Unable to load the feedback form.');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(content);
    });
    return;
  }

  response.writeHead(404);
  response.end('Not found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Feedback app listening on port ${port}`);
});
