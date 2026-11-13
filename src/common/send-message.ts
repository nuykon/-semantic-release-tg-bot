import type {Context, TGBotMessageFormat} from '../interfaces/config';
import * as https from 'node:https';
import * as proxyAgent from './proxy-agent';
import * as constants from './constants';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 1_048_576;
const sendMessage = async (message: {message: string; format: TGBotMessageFormat}, chatId: string | number, { logger, env }: Context): Promise<void> => {
    const token = env[constants.TG_BOT_TOKEN_ENV];
    if (!token)
        throw new Error('No Telegram token defined.');
    const proxy = env[constants.TG_BOT_PROXY_ENV];
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const agent = proxy ? new proxyAgent.ProxyAgent(proxy, signal) : undefined;
    const body = JSON.stringify({
        chat_id: chatId,
        text: message.message,
        parse_mode: message.format === 'html' ? 'HTML' : 'MarkdownV2',
    });
    logger.log(`Sending message to telegram chat (id=${chatId})...`);
    try {
        await new Promise<void>((resolve, reject) => {
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                agent,
                signal,
                headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
            }, (response) => {
                const chunks: Buffer[] = [];
                let bytes = 0;
                response.on('data', (chunk) => {
                    bytes += chunk.length;
                    if (bytes > MAX_RESPONSE_BYTES) {
                        response.destroy();
                        reject(new Error('Telegram API response is too large.'));
                    }
                    else
                        chunks.push(chunk);
                });
                response.on('error', () => reject(new Error('Unable to read Telegram API response.')));
                response.on('end', () => {
                    let result;
                    try {
                        result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                        if (!result || typeof result !== 'object')
                            throw new Error();
                    }
                    catch {
                        reject(new Error(`Invalid Telegram API response (HTTP ${response.statusCode}).`));
                        return;
                    }
                    if (response.statusCode !== 200 || result.ok !== true) {
                        // Do not propagate URLs, proxy credentials or the bot token from external errors.
                        const description = String(result.description ?? 'Request failed').split(token).join('[REDACTED]');
                        reject(new Error(`Telegram API error (${result.error_code ?? response.statusCode}): ${description}`));
                    }
                    else
                        resolve();
                });
            });
            req.on('error', (error) => {
                reject(new Error(`Telegram request failed (${(error as NodeJS.ErrnoException).code ?? 'NETWORK_ERROR'}).`));
            });
            req.end(body);
        });
    }
    finally {
        agent?.destroy();
    }
};

export {sendMessage};
