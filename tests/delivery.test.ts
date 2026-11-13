import {test} from 'node:test';
import {equal, deepEqual, ok, rejects, match} from 'node:assert/strict';
import {success, fail, type Context, type TGBotConfig} from '../index';
import {sendMessage} from '../src/common/send-message';
import {ProxyAgent} from '../src/common/proxy-agent';
import {captureTelegram, type Reply} from './support/telegram-double';

const runtime = (changes: Partial<Context> = {}): Context => ({
    logger: {log: () => undefined},
    env: {TELEGRAM_BOT_TOKEN: 'test-token-761', npm_package_name: 'observatory'},
    branch: {name: 'stable/4.x'},
    nextRelease: {version: '4.8.2', notes: '### Operations\n- Improved retry scheduling'},
    ...changes,
});

const settings: TGBotConfig = {notifications: [{chatIds: 456789}]};

test('one successful release delivers the default notification to a private user', async t => {
    const wire = captureTelegram(t);
    await success(settings, runtime());
    equal(wire.length, 1);
    equal(wire[0].payload.chat_id, 456789);
    match(wire[0].payload.text, /Release completed/);
    match(wire[0].payload.text, /observatory/);
    match(wire[0].payload.text, /4\\\.8\\\.2/);
});

test('recipient filtering combines native branch patterns, local opt-in and environment aliases', async t => {
    const wire = captureTelegram(t);
    const context = runtime();
    context.env.PERSON = '555001';
    await success({notifyOnSuccess: false, notifications: [
        {chatIds: 'disabled'},
        {chatIds: 'wrong-branch', notifyOnSuccess: true, branch: 'preview/**'},
        {chatIds: ['PERSON', -100456, '@releases'], notifyOnSuccess: true, branch: '{stable,maintenance}/*.x'},
    ]}, context);
    deepEqual(wire.map(entry => entry.payload.chat_id), ['555001', -100456, '@releases']);
});

test('recipient content wins over global content and preserves HTML mode', async t => {
    const wire = captureTelegram(t);
    await success({...settings, success: {message: 'global'}, notifications: [{
        chatIds: 77,
        success: {message: '<strong>${nextRelease.version}</strong>', format: 'html'},
    }]}, runtime());
    deepEqual(wire[0].payload, {chat_id: 77, text: '<strong>4.8.2</strong>', parse_mode: 'HTML'});
});

test('an explicitly supplied message does not require a prepared nextRelease', async t => {
    const wire = captureTelegram(t);
    await success({...settings, success: {message: 'Ready', format: 'html'}}, runtime({nextRelease: undefined}));
    equal(wire[0].payload.text, 'Ready');
});

test('early failures include the diagnosis only when failure notifications are enabled', async t => {
    const wire = captureTelegram(t);
    const context = runtime({nextRelease: undefined, errors: [new Error('artifact signing failed')]});
    await fail(settings, context);
    equal(wire.length, 0);
    await fail({...settings, notifyOnFail: true}, context);
    equal(wire.length, 1);
    match(wire[0].payload.text, /Release failed/);
    match(wire[0].payload.text, /artifact signing failed/);
});

test('empty templates and missing branch information never send a request', async t => {
    const wire = captureTelegram(t);
    await success({...settings, success: {message: ' \n '}}, runtime());
    await fail({...settings, notifyOnFail: true, fail: {message: ''}}, runtime());
    await success({notifications: [{chatIds: 99, branch: '**'}]}, runtime({branch: undefined}));
    equal(wire.length, 0);
});

test('the transport posts UTF-8 JSON and attaches a bounded request signal', async t => {
    const wire = captureTelegram(t);
    await sendMessage({message: 'Запуск 🚀', format: 'html'}, 'private-recipient', runtime());
    const {payload, options, bytes} = wire[0];
    equal(options.hostname, 'api.telegram.org');
    equal(options.method, 'POST');
    equal(options.path, '/bottest-token-761/sendMessage');
    equal((options.headers as Record<string, unknown>)['content-length'], bytes);
    ok(options.signal instanceof AbortSignal);
    deepEqual(payload, {chat_id: 'private-recipient', text: 'Запуск 🚀', parse_mode: 'HTML'});
});

test('proxy selection is explicit and the dedicated agent is released', async t => {
    const wire = captureTelegram(t);
    const context = runtime();
    context.env.TELEGRAM_BOT_PROXY = 'https://relay.invalid:8443';
    const dispose = t.mock.method(ProxyAgent.prototype, 'destroy', () => undefined);
    await sendMessage({message: 'proxy route', format: 'markdown'}, 12, context);
    const agent = wire[0].options.agent;
    ok(agent instanceof ProxyAgent);
    equal(agent.proxy.origin, 'https://relay.invalid:8443');
    equal(dispose.mock.callCount(), 1);
});

const rejectedResponses: ReadonlyArray<readonly [string, Reply, RegExp]> = [
    ['gateway markup', {raw: '<h1>temporarily unavailable</h1>'}, /Invalid Telegram API response/],
    ['JSON null', {raw: 'null'}, /Invalid Telegram API response/],
    ['HTTP error', {status: 503, value: {ok: false, description: 'try later'}}, /503.*try later/],
    ['API refusal', {status: 200, value: {ok: false, error_code: 403, description: 'bot blocked'}}, /403.*bot blocked/],
    ['missing confirmation', {status: 200, value: {}}, /Telegram API error/],
    ['oversized response', {raw: 'x'.repeat(1_048_577)}, /too large/],
    ['socket failure', {failure: Object.assign(new Error('test-token-761 must stay private'), {code: 'EPIPE'})}, /EPIPE/],
    ['deadline failure', {failure: Object.assign(new Error('timeout'), {code: 'ABORT_ERR'})}, /ABORT_ERR/],
];
for (const [label, reply, expected] of rejectedResponses) {
    test(`delivery rejects ${label}`, async t => {
        captureTelegram(t, reply);
        await rejects(sendMessage({message: 'status', format: 'markdown'}, 12, runtime()), expected);
    });
}

test('a token echoed by Telegram never escapes through the error message', async t => {
    captureTelegram(t, {status: 400, value: {ok: false, description: 'request test-token-761 refused'}});
    await rejects(sendMessage({message: 'status', format: 'html'}, 12, runtime()), issue =>
        issue instanceof Error && issue.message.includes('[REDACTED]') && !issue.message.includes('test-token-761'));
});
