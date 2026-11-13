import type {TGBotConfig, Context} from './interfaces/config';
import * as constants from './common/constants';
import * as errors from './common/semantic-release-error';
function verifyConditions(config: TGBotConfig, { logger, env }: Context): void {
    const botToken = env[constants.TG_BOT_TOKEN_ENV];
    if (!botToken) {
        logger.log(`${constants.TG_BOT_TOKEN_ENV} has not been defined.`);
        throw new errors.SemanticReleaseError('No Telegram token defined.', 'ENOTELEGRAMTOKEN', `A Telegram Bot Token must be created with BotFather and set in the \`${constants.TG_BOT_TOKEN_ENV}\` environment variable on your CI environment.\n\n\nPlease make sure you created a token and set it in the \`${constants.TG_BOT_TOKEN_ENV}\` environment variable on your CI environment.`);
    }
    if (!env.npm_package_name && !config.packageName && !env[constants.TG_BOT_PACKAGE_NAME]) {
        logger.log('npm package name, config packageName and SEMANTIC_RELEASE_PACKAGE name are undefined');
        throw new errors.SemanticReleaseError('No name for the package defined.', 'ENOPACKAGENAME', `A name for the package must be created. Define packageName in the plugin config or '${constants.TG_BOT_PACKAGE_NAME}' in the environment`);
    }
}

export {verifyConditions};
