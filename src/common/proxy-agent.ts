import type {Duplex} from 'node:stream';
import * as http from 'node:http';
import * as https from 'node:https';
import * as tls from 'node:tls';

class ProxyAgent extends https.Agent {
 readonly proxy: URL;
 private readonly signal: AbortSignal;
 constructor(address: string, signal: AbortSignal) {
  super({keepAlive: false});
  try { this.proxy = new URL(address); } catch { throw new Error('Invalid TELEGRAM_BOT_PROXY URL.'); }
  if (!['http:', 'https:'].includes(this.proxy.protocol)) throw new Error('TELEGRAM_BOT_PROXY must use HTTP or HTTPS.');
  this.signal = signal;
 }
 override createConnection(options: https.RequestOptions, callback?: (error: Error | null, socket: Duplex) => void): undefined {
  if (!callback) throw new Error('Proxy connections require a callback.');
  const proxy = this.proxy;
  const headers: Record<string, string> = {host: `${options.host}:${options.port}`};
  if (proxy.username || proxy.password) {
   headers['proxy-authorization'] = 'Basic ' + Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString('base64');
  }
  const connect = (proxy.protocol === 'https:' ? https : http).request({
   hostname: proxy.hostname.replace(/^\[|\]$/g, ''), port: proxy.port || (proxy.protocol === 'https:' ? 443 : 80),
   method: 'CONNECT', path: headers.host, headers, signal: this.signal, agent: false,
  });
  let finished = false;
  const done = (error: Error | null, socket?: Duplex): void => {
   if (finished) { if (error) socket?.destroy(); return; }
   finished = true;
   // Node ignores the stream argument when the callback receives an error.
   callback(error, socket as Duplex);
  };
  connect.once('error', () => done(new Error('Proxy connection failed.')));
  connect.once('response', response => {
   response.destroy(); done(new Error('Proxy refused CONNECT.'));
  });
  connect.once('connect', (response, socket, head) => {
   if (response.statusCode !== 200) {
    socket.destroy(); done(new Error(`Proxy CONNECT failed (HTTP ${response.statusCode}).`)); return;
   }
   if (head.length) socket.unshift(head);
   const secure = tls.connect({socket, servername: options.servername || options.host || undefined, ca: options.ca, rejectUnauthorized: true});
   const abort = () => secure.destroy(new Error('Proxy connection aborted.'));
   this.signal.addEventListener('abort', abort, {once: true});
   secure.once('close', () => this.signal.removeEventListener('abort', abort));
   secure.once('error', () => done(new Error('Proxy TLS connection failed.')));
   secure.once('secureConnect', () => done(null, secure));
   if (this.signal.aborted) abort();
  });
  connect.end();
  return undefined;
 }
}
export {ProxyAgent};
