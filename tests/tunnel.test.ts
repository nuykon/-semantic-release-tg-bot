import {test} from 'node:test';
import {equal, rejects, throws} from 'node:assert/strict';
import {createServer as plainServer} from 'node:http';
import * as https from 'node:https';
import {connect} from 'node:net';
import {readFileSync} from 'node:fs';
import {ProxyAgent} from '../src/common/proxy-agent';
import {bindLoopback} from './support/local-services';

const identity = {
    key: readFileSync('tests/fixtures/localhost-key.pem'),
    cert: readFileSync('tests/fixtures/localhost-cert.pem'),
};
const fetchThrough = (port: number, agent: ProxyAgent, trust?: Buffer): Promise<string> => new Promise((accept, decline) => {
    const request = https.request({hostname: '127.0.0.1', port, servername: 'localhost', ca: trust, agent}, response => {
        const fragments: Buffer[] = [];
        response.on('data', fragment => fragments.push(Buffer.from(fragment)));
        response.on('error', decline);
        response.on('end', () => accept(Buffer.concat(fragments).toString('utf8')));
    });
    request.on('error', decline).end();
});

for (const encryptedProxy of [false, true]) {
    test(`CONNECT forwarding through ${encryptedProxy ? 'TLS' : 'plain HTTP'} keeps destination certificates and proxy credentials separate`, async t => {
        let receivedAuthorization: string | string[] | undefined;
        const destination = https.createServer(identity, (request, response) => {
            equal(request.headers['proxy-authorization'], undefined);
            response.end('encrypted application payload');
        });
        const endpoint = await bindLoopback(t, destination);
        const relay = encryptedProxy ? https.createServer(identity) : plainServer();
        relay.on('connect', (request, downstream, remainder) => {
            receivedAuthorization = request.headers['proxy-authorization'];
            const upstream = connect({host: '127.0.0.1', port: Number(endpoint.port)});
            upstream.once('connect', () => {
                downstream.write('HTTP/1.1 200 Tunnel ready\r\n\r\n');
                if (remainder.byteLength) upstream.write(remainder);
                downstream.pipe(upstream);
                upstream.pipe(downstream);
            });
            downstream.on('error', () => upstream.destroy());
            downstream.once('close', () => upstream.destroy());
            upstream.on('error', () => downstream.destroy());
        });
        const address = await bindLoopback(t, relay);
        address.protocol = encryptedProxy ? 'https:' : 'http:';
        address.username = 'operator';
        address.password = 's%3Aecret';
        const agent = new ProxyAgent(address.href, AbortSignal.timeout(2000));
        t.after(() => agent.destroy());
        if (encryptedProxy) {
            const original = https.request;
            const request = (options: https.RequestOptions, callback: (response: import('node:http').IncomingMessage) => void) =>
                original({...options, ca: identity.cert, servername: 'localhost'}, callback);
            t.mock.method(https, 'request', request as typeof https.request);
        }
        equal(await fetchThrough(Number(endpoint.port), agent, identity.cert), 'encrypted application payload');
        equal(receivedAuthorization, `Basic ${Buffer.from('operator:s:ecret').toString('base64')}`);
        if (!encryptedProxy) await rejects(fetchThrough(Number(endpoint.port), agent), /TLS connection failed/);
    });
}

for (const behavior of ['reject', 'stall'] as const) {
    test(`a proxy that will ${behavior} the tunnel cannot keep the hook waiting indefinitely`, async t => {
        const relay = plainServer();
        relay.on('connect', (_request, socket) => {
            if (behavior === 'reject') socket.end('HTTP/1.1 502 Upstream unavailable\r\n\r\n');
        });
        const address = await bindLoopback(t, relay);
        const agent = new ProxyAgent(address.href, AbortSignal.timeout(75));
        t.after(() => agent.destroy());
        await rejects(fetchThrough(443, agent), behavior === 'reject' ? /502/ : /Proxy connection failed/);
    });
}

test('invalid proxy settings fail before networking starts', () => {
    for (const address of ['socks://relay.invalid', 'ftp://relay.invalid', 'missing-url']) {
        throws(() => new ProxyAgent(address, AbortSignal.timeout(500)));
    }
});
