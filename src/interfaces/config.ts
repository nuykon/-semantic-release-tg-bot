/** Stable configuration vocabulary retained for existing consuming projects. */
export type TGBotChatId = number | string;
export type TGBotMessageFormat = 'markdown' | 'html';

type ReleaseVersion = {version: string; notes?: string};
type ReleaseBranch = {name: string};
type Variables = Record<string, string | undefined>;

export type Context = {
    env: Variables;
    logger: {log: (entry: string) => void};
    nextRelease?: ReleaseVersion;
    lastRelease?: unknown;
    branch?: ReleaseBranch;
    errors?: Error[];
    commits?: readonly unknown[];
};

export type TemplateContext = {
    [variable: string]: unknown;
    packageName?: string;
    nextRelease?: ReleaseVersion;
    lastRelease?: unknown;
    branch?: ReleaseBranch;
    errors?: Error[];
    commits?: readonly unknown[];
};

type TemplateData<T> = {customData?: Record<string, T>};
export type TGBotMessage<T = unknown> = TemplateData<T> & {
    message: string | ((data: TemplateContext) => string);
    format?: TGBotMessageFormat;
};
export type TGBotMessageTemplate<T = unknown> = TemplateData<T> & {path: string};
type Content = TGBotMessage | TGBotMessageTemplate;
export type TGBotNotify = Partial<{
    success: Content;
    fail: Content;
    notifyOnSuccess: boolean;
    notifyOnFail: boolean;
}>;
export type TGBotNotificationConfig = TGBotNotify & {
    branch?: string;
    chatIds: TGBotChatId | TGBotChatId[];
};
export type TGBotConfig = TGBotNotify & {
    packageName?: string;
    notifications: TGBotNotificationConfig[];
};
