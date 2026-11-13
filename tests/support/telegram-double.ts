import {Readable, Writable} from 'node:stream';
import * as https from 'node:https';
import type {ClientRequest, IncomingMessage} from 'node:http';
import type {TestContext} from 'node:test';

export type TelegramRequest = {
    chat_id: string | number;
    text: string;
    parse_mode: 'HTML' | 'MarkdownV2';
};
export type Exchange = {options: https.RequestOptions; payload: TelegramRequest; bytes: number};
export type Reply = {status: number; value: unknown} | {failure: NodeJS.ErrnoException} | {raw: string};

/** A writable HTTP boundary double; the production client still serializes its own request. */
export const captureTelegram = (scope: TestContext, reply: Reply = {status: 200, value: {ok: true}}): Exchange[] => {
    const exchanges: Exchange[] = [];
    const implementation = (options: https.RequestOptions, onResponse: (incoming: IncomingMessage) => void): ClientRequest => {
        const body: Buffer[] = [];
        const sink = new Writable({
            write(fragment: Buffer, _encoding, completed) {
                body.push(Buffer.from(fragment));
                completed();
            },
            final(completed) {
                const bytes = Buffer.concat(body);
                exchanges.push({options, payload: JSON.parse(bytes.toString('utf8')) as TelegramRequest, bytes: bytes.length});
                completed();
                setImmediate(() => {
                    if ('failure' in reply) {
                        sink.emit('error', reply.failure);
                    } else {
                        const raw = 'raw' in reply ? reply.raw : JSON.stringify(reply.value);
                        const incoming = Object.assign(Readable.from([Buffer.from(raw)]), {
                            statusCode: 'status' in reply ? reply.status : 200,
                        });
                        onResponse(incoming as unknown as IncomingMessage);
                    }
                });
            },
        });
        return sink as unknown as ClientRequest;
    };
    scope.mock.method(https, 'request', implementation as typeof https.request);
    return exchanges;
};
