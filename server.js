import http from 'node:http';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.PORT || 3000);
const lag = monitorEventLoopDelay({ resolution: 20 }); lag.enable();
let requests = 0, apiRequests = 0, active = 0;
let previousCpu = process.cpuUsage(), previousTime = performance.now(), cpuPercent = 0;
setInterval(() => {
  const now = performance.now(), cpu = process.cpuUsage();
  cpuPercent = (cpu.user - previousCpu.user + cpu.system - previousCpu.system) / ((now - previousTime) * 1000) * 100;
  previousCpu = cpu; previousTime = now;
}, 1000).unref();
async function readNumber(path) {
  try { const text = (await readFile(path, 'utf8')).trim(); return text === 'max' ? null : Number(text); } catch { return null; }
}
async function metrics() {
  const [memoryCurrent, memoryLimit] = await Promise.all([
    readNumber('/sys/fs/cgroup/memory.current'), readNumber('/sys/fs/cgroup/memory.max')
  ]);
  return {
    serverTime: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: os.platform(), release: os.release(), architecture: os.arch(),
    node: process.version, cpuModel: os.cpus()[0]?.model || 'unknown',
    hostLogicalCpus: os.cpus().length, availableParallelism: os.availableParallelism(),
    processCpuPercentOneCore: Math.round(cpuPercent * 10) / 10,
    hostMemoryTotal: os.totalmem(), hostMemoryFree: os.freemem(),
    cgroupMemoryCurrent: memoryCurrent, cgroupMemoryLimit: memoryLimit,
    processMemory: process.memoryUsage(),
    processUptimeSeconds: Math.floor(process.uptime()), hostUptimeSeconds: Math.floor(os.uptime()),
    hostLoadAverage: os.loadavg(), requests, apiRequests, activeRequests: active,
    eventLoopDelayMeanMs: Number.isFinite(lag.mean) ? Math.round(lag.mean / 1e6 * 100) / 100 : null
  };
}
const assets = {
  '/': ['server.html','text/html'], '/server.html': ['server.html','text/html'],
  '/server-dashboard.js': ['server-dashboard.js','text/javascript'],
  '/pc-info.css': ['pc-info.css','text/css'], '/pc-info.js': ['pc-info.js','text/javascript'],
  '/index.html': ['index.html','text/html']
};
const server = http.createServer(async (req, res) => {
  requests++; active++;
  let completed = false;
  const finish = () => { if (!completed) { active--; completed = true; } };
  res.once('finish', finish); res.once('close', finish);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return; }
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/healthz') { res.writeHead(200, {'Content-Type':'text/plain'}); res.end(req.method === 'HEAD' ? undefined : 'ok'); return; }
    if (path === '/api/server-info') {
      apiRequests++;
      const data = JSON.stringify(await metrics());
      res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
      res.end(req.method === 'HEAD' ? undefined : data); return;
    }
    const asset = assets[path];
    if (!asset) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(new URL(asset[0], import.meta.url));
    res.writeHead(200, {'Content-Type':asset[1] + '; charset=utf-8'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Internal server error'); }
});
server.listen(port,'0.0.0.0', () => console.log('codesea listening on port ' + server.address().port));
process.on('SIGTERM', () => { server.close(); setTimeout(() => process.exit(0), 5000).unref(); });
