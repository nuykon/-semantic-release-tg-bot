import type {Context, TGBotMessage} from '../interfaces/config';

export type ReleaseOutcome = 'success' | 'fail';

export const composeNotification = (
    outcome: ReleaseOutcome,
    label: string | undefined,
    runtime: Pick<Context, 'nextRelease' | 'errors'>,
): TGBotMessage | undefined => {
    const paragraphs = [`# Release ${outcome === 'success' ? 'completed' : 'failed'}`, `Package: ${label ?? 'unnamed package'}`];
    if (outcome === 'success') {
        if (!runtime.nextRelease) return undefined;
        paragraphs.push(`Version: ${runtime.nextRelease.version}`);
        if (runtime.nextRelease.notes?.trim()) paragraphs.push(runtime.nextRelease.notes);
    } else {
        for (const failure of runtime.errors ?? []) {
            paragraphs.push(`${failure.name}: ${failure.message}`);
            if (failure.stack) paragraphs.push(['```', failure.stack, '```'].join('\n'));
        }
    }
    return {format: 'markdown', message: paragraphs.join('\n\n')};
};
