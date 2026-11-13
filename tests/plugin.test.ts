import type {Context} from '../src/interfaces/config';
import type {TestContext} from 'node:test';
import type {ClientRequest, IncomingMessage} from 'node:http';
import {SemanticReleaseError} from '../src/common/semantic-release-error';
import {renderMessage} from '../src/common/render-message';
import {ProxyAgent} from '../src/common/proxy-agent';
import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as https from 'node:https';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {success, fail, verifyConditions} from '../index';
import {sendMessage} from '../src/common/send-message';

const context = (extra: Partial<Context> = {}): Context => ({
 logger: {log() {}}, env: {TELEGRAM_BOT_TOKEN: '123:secret', npm_package_name: 'example'},
 branch: {name: 'release/1.x'}, nextRelease: {version: '1.2.0'}, ...extra,
});
interface TelegramBody {
 chat_id: string | number;
 text: string;
 parse_mode: string;
}
interface CapturedRequest {
 options: https.RequestOptions & {headers: Record<string, string | number>};
 body: TelegramBody;
}
interface ResponseFixture {
 status?: number;
 response?: {ok: boolean; error_code?: number; description?: string};
 error?: Error;
 raw?: string;
}
const intercept = (t: TestContext, {status = 200, response = {ok: true}, error, raw}: ResponseFixture = {}): CapturedRequest[] => {
 const requests: CapturedRequest[] = [];
 const request = (options: CapturedRequest['options'], callback: (response: IncomingMessage) => void): ClientRequest => {
  const req = Object.assign(new EventEmitter(), {
   end: (body: string): void => {
    requests.push({options, body: JSON.parse(body) as TelegramBody});
    queueMicrotask(() => {
     if (error) { req.emit('error', error); return; }
     const res = Object.assign(new PassThrough(), {statusCode: status});
     callback(res as unknown as IncomingMessage);
     res.end(raw ?? JSON.stringify(response));
    });
   },
  });
  return req as unknown as ClientRequest;
 };
 t.mock.method(https, 'request', request as typeof https.request);
 return requests;
};
test('sends JSON with Unicode byte length and HTML parse mode', async t => {
 const requests = intercept(t);
 await sendMessage({message: '<b>Привет</b>', format: 'html'}, -123, context());
 assert.equal(requests[0].options.hostname, 'api.telegram.org');
 assert.equal(requests[0].options.path, '/bot123:secret/sendMessage');
 assert.equal(requests[0].options.method, 'POST');
 assert.equal(requests[0].options.headers['content-length'], Buffer.byteLength(JSON.stringify(requests[0].body)));
 assert.deepEqual(requests[0].body, {chat_id: -123, text: '<b>Привет</b>', parse_mode: 'HTML'});
 assert.ok(requests[0].options.signal instanceof AbortSignal);
});
test('uses configured proxy and destroys its agent', async t => {
 const requests = intercept(t);
 const ctx = context();
 ctx.env.TELEGRAM_BOT_PROXY = 'http://localhost:8080';
 const destroy = t.mock.method(ProxyAgent.prototype, 'destroy', () => {});
 await sendMessage({message: 'Hello', format: 'markdown'}, 123, ctx);
 const agent = requests[0].options.agent;
 assert.ok(agent instanceof ProxyAgent);
 assert.equal(agent.proxy.href, 'http://localhost:8080/');
 assert.equal(destroy.mock.callCount(), 1);
});
test('rejects Telegram API failures and redacts token', async t => {
 intercept(t, {status: 429, response: {ok: false, error_code: 429, description: 'failed 123:secret'}});
 await assert.rejects(sendMessage({message: 'Hi', format: 'markdown'}, 1, context()), e =>
  e instanceof Error && e.message.includes('429') && !e.message.includes('123:secret'));
});
test('rejects invalid JSON', async t => {
 intercept(t, {raw: '<html>gateway error</html>'});
 await assert.rejects(sendMessage({message: 'Hi', format: 'markdown'}, 1, context()), /Invalid Telegram API response/);
});
test('rejects API errors even with HTTP 200', async t => {
 intercept(t, {response: {ok: false, description: 'Bad chat'}});
 await assert.rejects(sendMessage({message: 'Hi', format: 'markdown'}, 1, context()), /Bad chat/);
});
test('network failures do not expose URL or credentials', async t => {
 intercept(t, {error: Object.assign(new Error('https://api.telegram.org/bot123:secret'), {code: 'ECONNRESET'})});
 await assert.rejects(sendMessage({message: 'Hi', format: 'markdown'}, 1, context()), {message: 'Telegram request failed (ECONNRESET).'});
});
test('success filters branches, applies per-notification flags and resolves chat IDs from context.env', async t => {
 const requests = intercept(t);
 const ctx = context(); ctx.env.CHAT = '-777';
 await success({notifyOnSuccess: false, notifications: [
  {chatIds: 1},
  {chatIds: 2, notifyOnSuccess: true, branch: 'main'},
  {chatIds: ['CHAT', 3], notifyOnSuccess: true, branch: 'release/*.x'},
 ]}, ctx);
 assert.deepEqual(requests.map(r => r.body.chat_id), ['-777', 3]);
 assert.equal(requests[0].body.parse_mode, 'MarkdownV2');
 assert.match(requests[0].body.text, /example/);
});
test('default failure notification works before nextRelease exists', async t => {
 const requests = intercept(t);
 await fail({notifyOnFail: true, notifications: [{chatIds: 1}]}, context({nextRelease: undefined, errors: [new Error('Publish failed')]}));
 assert.equal(requests.length, 1);
 assert.match(requests[0].body.text, /Publish failed/);
});
test('empty success and failure messages are skipped', async t => {
 const requests = intercept(t);
 const config = {notifyOnFail: true, success: {message: ''}, fail: {message: '  '}, notifications: [{chatIds: 1}]};
 await success(config, context()); await fail(config, context());
 assert.equal(requests.length, 0);
});
test('failure is disabled by default and missing branch cannot match a filter', async t => {
 const requests = intercept(t);
 await fail({notifications: [{chatIds: 1}]}, context());
 await success({notifications: [{chatIds: 1, branch: '*'}]}, context({branch: undefined}));
 assert.equal(requests.length, 0);
});
test('verification exposes semantic-release-compatible errors and uses context.env', () => {
 assert.throws(() => verifyConditions({notifications: []}, context({env: {}})), e => e instanceof SemanticReleaseError && e.code === 'ENOTELEGRAMTOKEN' && e.semanticRelease === true && !!e.details);
 assert.throws(() => verifyConditions({notifications: []}, context({env: {TELEGRAM_BOT_TOKEN: 'token'}})), e => e instanceof SemanticReleaseError && e.code === 'ENOPACKAGENAME');
 assert.doesNotThrow(() => verifyConditions({notifications: []}, context()));
});
test('custom data overrides context and message callbacks support custom logic', () => {
 assert.equal(renderMessage({message: '${branch.name}: {{ title }}', format: 'html', customData: {title: 'Custom'}}, {branch: {name: 'main'}, title: 'Old'}).message, 'main: Custom');
 assert.equal(renderMessage({message: ({items}) => Array.isArray(items) ? items.join('') : '', format: 'html', customData: {items: ['a', 'b']}}).message, 'ab');
});
