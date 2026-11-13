export type TGBotChatId = string | number;
export type TGBotMessageFormat = 'html' | 'markdown';

export interface Context {
 logger: {log(message: string): void};
 env: Record<string, string | undefined>;
 branch?: {name: string};
 lastRelease?: unknown;
 nextRelease?: {version: string; notes?: string};
 commits?: readonly unknown[];
 errors?: Error[];
}

export interface TemplateContext {
 packageName?: string;
 branch?: Context['branch'];
 lastRelease?: unknown;
 nextRelease?: Context['nextRelease'];
 commits?: readonly unknown[];
 errors?: Error[];
 [key: string]: unknown;
}

export interface TGBotMessage<T = unknown> {
 message: string | ((context: TemplateContext) => string);
 format?: TGBotMessageFormat;
 customData?: Record<string, T>;
}

export interface TGBotMessageTemplate<T = unknown> {
 path: string;
 customData?: Record<string, T>;
}

export interface TGBotNotify {
 notifyOnSuccess?: boolean;
 notifyOnFail?: boolean;
 success?: TGBotMessage | TGBotMessageTemplate;
 fail?: TGBotMessage | TGBotMessageTemplate;
}

export interface TGBotNotificationConfig extends TGBotNotify {
 chatIds: TGBotChatId | TGBotChatId[];
 branch?: string;
}

export interface TGBotConfig extends TGBotNotify {
 notifications: TGBotNotificationConfig[];
 packageName?: string;
}
