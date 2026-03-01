const db = require('./db');

const AQUAREA_BASE = 'https://aquarea-smart.panasonic.com';
const AUTH_URL = `${AQUAREA_BASE}/remote/v1/api/auth/login`;
const DEVICES_URL = `${AQUAREA_BASE}/remote/v1/api/devices`;

// In serverless context, these are per-invocation (no persistent state)
let sessionToken = null;
let tokenExpiry = 0;
let cachedDeviceId = null;

async function authenticate() {
  const email = process.env.PANASONIC_EMAIL;
  const password = process.env.PANASONIC_PASSWORD;
  if (!email || !password) {
    return false;
  }

  try {
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: email, password })
    });

    if (!response.ok) return false;

    const data = await response.json();
    sessionToken = data.uToken || data.accessToken || data.token;
    tokenExpiry = Date.now() + 3500 * 1000;
    return true;
  } catch (err) {
    console.error('[Aquarea] Auth error:', err.message);
    return false;
  }
}

async function ensureAuth() {
  if (!sessionToken || Date.now() > tokenExpiry) {
    return await authenticate();
  }
  return true;
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cookie': `uToken=${sessionToken}`
  };
}

async function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  if (!await ensureAuth()) return null;

  try {
    const response = await fetch(DEVICES_URL, { headers: getAuthHeaders() });
    if (!response.ok) return null;

    const data = await response.json();
    const devices = data.devices || data.deviceList || [];
    if (devices.length === 0) return null;

    cachedDeviceId = devices[0].deviceId || devices[0].gwid;
    return cachedDeviceId;
  } catch (err) {
    console.error('[Aquarea] Device list error:', err.message);
    return null;
  }
}

async function fetchDeviceStatus() {
  await db.ensureDb();
  if (!await ensureAuth()) return null;

  const deviceId = await getDeviceId();
  if (!deviceId) return null;

  try {
    const url = `${DEVICES_URL}/${deviceId}/status`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) return null;

    const data = await response.json();
    const status = {
      outdoor_temp: data.outdoorTemperature ?? data.outdoorTemp ?? null,
      water_temp: data.waterTemperature ?? data.waterTemp ?? null,
      setpoint: data.setTemperature ?? data.setpoint ?? null,
      mode: data.operationMode ?? data.mode ?? 'unknown',
      power_w: data.power ?? data.currentPower ?? 0
    };

    await db.insertDeviceStatus(status);
    return status;
  } catch (err) {
    console.error('[Aquarea] Status error:', err.message);
    return null;
  }
}

async function setTemperature(targetTemp, mode = 'heat') {
  if (!await ensureAuth()) return { success: false, error: 'Authentication failed' };
  const deviceId = await getDeviceId();
  if (!deviceId) return { success: false, error: 'No device found' };

  try {
    const url = `${DEVICES_URL}/${deviceId}/status`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ setTemperature: targetTemp, operationMode: mode })
    });

    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    return { success: true, targetTemp, mode };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function setMode(mode) {
  if (!await ensureAuth()) return { success: false, error: 'Authentication failed' };
  const deviceId = await getDeviceId();
  if (!deviceId) return { success: false, error: 'No device found' };

  try {
    const url = `${DEVICES_URL}/${deviceId}/status`;
    const body = {};
    if (mode === 'off') body.operationStatus = 0;
    else if (mode === 'on') body.operationStatus = 1;
    else if (mode === 'eco') { body.ecoMode = 1; body.operationStatus = 1; }

    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    return { success: true, mode };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getStatus() {
  await db.ensureDb();
  return await db.getLatestDeviceStatus();
}

async function getHistory(days = 7) {
  await db.ensureDb();
  return await db.getDeviceHistory(days);
}

function isApiReachable() {
  return !!(process.env.PANASONIC_EMAIL && process.env.PANASONIC_PASSWORD);
}

module.exports = {
  fetchDeviceStatus,
  setTemperature,
  setMode,
  getStatus,
  getHistory,
  isApiReachable,
  authenticate
};
