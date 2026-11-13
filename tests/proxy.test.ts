import type {TestContext} from 'node:test';
import type {AddressInfo, Socket} from 'node:net';
import type {IncomingMessage} from 'node:http';
import {resolve} from 'node:path';
import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import {readFileSync} from 'node:fs';
import {ProxyAgent} from '../src/common/proxy-agent';
// Public test-only key/certificate, never used outside this localhost fixture.
const credentials = {
 key: readFileSync(resolve('tests/fixtures/localhost-key.pem')),
 cert: readFileSync(resolve('tests/fixtures/localhost-cert.pem')),
};
const listen = async (t: TestContext, server: http.Server | https.Server): Promise<number> => {
 const sockets = new Set<Socket>();
 server.on('connection', (socket: Socket) => {
  sockets.add(socket); socket.once('close', () => sockets.delete(socket));
 });
 await new Promise<void>((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
 t.after(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
 });
 return (server.address() as AddressInfo).port;
};
const get = (port: number, agent: ProxyAgent, ca?: Buffer): Promise<string> => new Promise<string>((resolve, reject) => {
 const req = https.get({hostname: '127.0.0.1', port, servername: 'localhost', agent, ca}, res => {
  let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk); res.on('end', () => resolve(body));
 });
 req.on('error', reject);
});
for (const protocol of ['http', 'https']) {
 test(`${protocol} proxy CONNECT carries authenticated, certificate-verified TLS traffic`, async t => {
  let authorization: string | string[] | undefined;
  let destination: string | undefined;
  let targetAuthorization: string | string[] | undefined;
  const target = https.createServer(credentials, (req, res) => {
   targetAuthorization = req.headers['proxy-authorization']; res.end('tunnel works');
  });
  const targetPort = await listen(t, target);
  const proxy = protocol === 'https' ? https.createServer(credentials) : http.createServer();
  const proxyPort = await listen(t, proxy);
  proxy.on('connect', (req, client, head) => {
   authorization = req.headers['proxy-authorization']; destination = req.url;
   const upstream = net.connect(targetPort, '127.0.0.1', () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) upstream.write(head);
    client.pipe(upstream).pipe(client);
   });
   upstream.on('error', () => client.destroy());
   client.on('error', () => upstream.destroy());
   client.once('close', () => upstream.destroy());
  });
  const signal = AbortSignal.timeout(3000);
  const agent = new ProxyAgent(`${protocol}://user:p%40ss@127.0.0.1:${proxyPort}`, signal);
  t.after(() => agent.destroy());
  if (protocol === 'https') {
   // Trust the fixture CA for the proxy connection without disabling TLS verification.
   const original = https.request;
   const request = (options: https.RequestOptions, callback: (response: IncomingMessage) => void) => original({...options, ca: credentials.cert, servername: 'localhost'}, callback);
   t.mock.method(https, 'request', request as typeof https.request);
  }
  assert.equal(await get(targetPort, agent, credentials.cert), 'tunnel works');
  assert.equal(authorization, 'Basic ' + Buffer.from('user:p@ss').toString('base64'));
  assert.equal(destination, `127.0.0.1:${targetPort}`);
  assert.equal(targetAuthorization, undefined);
 });
}
test('proxy rejection propagates without exposing credentials', async t => {
 const proxy = http.createServer();
 proxy.on('connect', (_, socket) => socket.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n'));
 const port = await listen(t, proxy);
 const agent = new ProxyAgent(`http://user:secret@127.0.0.1:${port}`, AbortSignal.timeout(1000));
 t.after(() => agent.destroy());
 await assert.rejects(get(443, agent), {message: 'Proxy CONNECT failed (HTTP 407).'});
});
test('proxy CONNECT obeys the request deadline', async t => {
 const proxy = http.createServer(); proxy.on('connect', () => {});
 const port = await listen(t, proxy);
 const agent = new ProxyAgent(`http://127.0.0.1:${port}`, AbortSignal.timeout(50));
 t.after(() => agent.destroy());
 await assert.rejects(get(443, agent), /Proxy connection failed/);
});
test('unsupported proxy protocols and invalid addresses fail clearly', () => {
 assert.throws(() => new ProxyAgent('socks5://localhost', AbortSignal.timeout(1000)), /HTTP or HTTPS/);
 assert.throws(() => new ProxyAgent('private-secret', AbortSignal.timeout(1000)), {message: 'Invalid TELEGRAM_BOT_PROXY URL.'});
});
test('proxy tunnel rejects an untrusted target certificate', async t => {
 const target = https.createServer(credentials, (_, res) => res.end('must not be accepted'));
 const targetPort = await listen(t, target);
 const proxy = http.createServer();
 proxy.on('connect', (_, client) => {
  const upstream = net.connect(targetPort, '127.0.0.1', () => {
   client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
   client.pipe(upstream).pipe(client);
  });
  upstream.on('error', () => client.destroy());
  client.on('error', () => upstream.destroy());
  client.once('close', () => upstream.destroy());
 });
 const port = await listen(t, proxy);
 const agent = new ProxyAgent(`http://127.0.0.1:${port}`, AbortSignal.timeout(1000));
 t.after(() => agent.destroy());
 await assert.rejects(get(targetPort, agent), /Proxy TLS connection failed/);
});
