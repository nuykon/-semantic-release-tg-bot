import type {Context, TGBotConfig} from '../interfaces/config';

export const environment = {
    token: 'TELEGRAM_BOT_TOKEN',
    label: 'SEMANTIC_RELEASE_PACKAGE',
    proxy: 'TELEGRAM_BOT_PROXY',
} as const;

export const packageLabel = (settings: TGBotConfig, variables: Context['env']): string | undefined =>
    [settings.packageName, variables[environment.label], variables.npm_package_name]
        .find(candidate => typeof candidate === 'string' && candidate.trim().length > 0);

export type ConfigurationIssue = Error & {
    code: 'ENOTELEGRAMTOKEN' | 'ENOPACKAGENAME';
    details: string;
    semanticRelease: true;
};

export const configurationIssue = (code: ConfigurationIssue['code'], details: string): ConfigurationIssue =>
    Object.assign(new Error(`Telegram notification configuration is incomplete (${code}).`), {
        name: 'TelegramConfigurationError',
        code,
        details,
        semanticRelease: true as const,
    });
