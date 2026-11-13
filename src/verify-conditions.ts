import type {Context, TGBotConfig} from './interfaces/config';
import {configurationIssue, environment, packageLabel} from './common/configuration';

/** Validate the two inputs needed to build and deliver default notifications. */
export const verifyConditions = (settings: TGBotConfig, runtime: Context): void => {
    const requirements = [
        {
            satisfied: Boolean(runtime.env[environment.token]?.trim()),
            code: 'ENOTELEGRAMTOKEN' as const,
            help: `Provide a BotFather token through ${environment.token} in the release environment.`,
        },
        {
            satisfied: packageLabel(settings, runtime.env) !== undefined,
            code: 'ENOPACKAGENAME' as const,
            help: `Set packageName in the plugin options, ${environment.label}, or npm_package_name.`,
        },
    ];
    const missing = requirements.find(requirement => !requirement.satisfied);
    if (missing) {
        runtime.logger.log(missing.help);
        throw configurationIssue(missing.code, missing.help);
    }
};
