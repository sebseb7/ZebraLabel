#!/usr/bin/env node
/* eslint-env node */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3456);
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = path.join(__dirname, 'prices.json');

function readDatabase() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

function writeDatabase(data) {
  fs.writeFileSync(DB_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function sendJson(res, statusCode, payload, logMeta = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);

  const parts = [
    new Date().toISOString(),
    logMeta.remoteAddress || '-',
    logMeta.method || '-',
    logMeta.path || '-',
    String(statusCode),
  ];

  if (logMeta.barcode) {
    parts.push(`barcode=${logMeta.barcode}`);
  }

  if (logMeta.requestBody) {
    parts.push(`body=${logMeta.requestBody}`);
  }

  console.log(parts.join(' | '));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', chunk => {
      chunks.push(chunk);
      if (chunks.reduce((sum, part) => sum + part.length, 0) > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function parseBarcode(pathname) {
  const prefix = '/prices/';
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const barcode = decodeURIComponent(pathname.slice(prefix.length));
  return barcode || null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const barcode = parseBarcode(url.pathname);
  const logMeta = {
    method: req.method,
    path: url.pathname + url.search,
    remoteAddress: req.socket.remoteAddress,
    barcode: barcode || undefined,
  };

  const respond = (statusCode, payload, extra = {}) => {
    sendJson(res, statusCode, payload, {...logMeta, ...extra});
  };

  if (!barcode) {
    if (url.pathname === '/' && req.method === 'GET') {
      respond(200, {
        name: 'ZebraLabel demo price API',
        endpoints: {
          lookup: 'GET /prices/{barcode}',
          save: 'PUT /prices/{barcode} {"price":"4.99"}',
        },
      });
      return;
    }

    respond(404, {error: 'Not found'});
    return;
  }

  const database = readDatabase();

  if (req.method === 'GET') {
    const entry = database[barcode];
    if (!entry || entry.price == null || entry.price === '') {
      respond(404, {price: null});
      return;
    }

    respond(200, {price: String(entry.price)});
    return;
  }

  if (req.method === 'PUT') {
    let body = '';

    try {
      body = await readBody(req);
    } catch (error) {
      respond(413, {error: error.message}, {requestBody: body || undefined});
      return;
    }

    let payload;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      respond(400, {error: 'Invalid JSON body'}, {requestBody: body});
      return;
    }

    const price = payload?.price;
    if (price == null || price === '') {
      respond(400, {error: 'Missing price'}, {requestBody: body});
      return;
    }

    database[barcode] = {
      price: String(price),
      updatedAt: new Date().toISOString(),
    };
    writeDatabase(database);
    respond(200, database[barcode], {requestBody: body});
    return;
  }

  respond(405, {error: 'Method not allowed'});
});

server.listen(PORT, HOST, () => {
  console.log(`Demo price API listening on http://${HOST}:${PORT}`);
  console.log(`Database file: ${DB_PATH}`);
});
