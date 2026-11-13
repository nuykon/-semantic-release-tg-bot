import type {TGBotConfig, Context} from '../interfaces/config';
import * as arrays from '../helpers/as-array';
import {posix} from 'node:path';
import * as renderer from './render-message';
import * as telegram from './send-message';
import * as successMessage from './default-success-message';
import * as failMessage from './default-fail-message';
const notify = async (event: 'success' | 'fail', config: TGBotConfig, context: Context): Promise<void> => {
    const { logger, env, branch, lastRelease, nextRelease, commits, errors } = context;
    const packageName = config.packageName || env.SEMANTIC_RELEASE_PACKAGE || env.npm_package_name;
    const flag = event === 'success' ? 'notifyOnSuccess' : 'notifyOnFail';
    for (const notification of arrays.asArray(config.notifications)) {
        if (!(notification[flag] ?? config[flag] ?? (event === 'success')))
            continue;
        if (notification.branch && (!branch || !posix.matchesGlob(branch.name, notification.branch)))
            continue;
        const message = notification[event] ?? config[event] ?? (event === 'success'
            ? nextRelease && successMessage.defaultSuccessMessage(packageName, nextRelease)
            : failMessage.defaultFailMessage(packageName, errors ?? []));
        if (!message)
            continue;
        const rendered = renderer.renderMessage(message, { packageName, branch, lastRelease, nextRelease, commits, errors });
        if (!rendered.message) {
            logger.log('Telegram message is empty. Nothing to send!');
            continue;
        }
        logger.log(`Sending telegram notification on ${event} (branch = ${notification.branch || 'all'})...`);
        for (const id of arrays.asArray(notification.chatIds)) {
            const chatId = typeof id === 'string' ? env[id] || id : id;
            await telegram.sendMessage(rendered, chatId, context);
        }
    }
};

export {notify};
