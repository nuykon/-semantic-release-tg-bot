import type {Context, TGBotMessage} from '../interfaces/config';
function defaultSuccessMessage(packageName: string | undefined, nextRelease: NonNullable<Context['nextRelease']>): TGBotMessage {
    let message = `**${packageName} v${nextRelease.version}** has been released!`;
    if (nextRelease.notes) {
        message += `\n${nextRelease.notes}`;
    }
    return {
        message,
        format: 'markdown'
    };
}

export {defaultSuccessMessage};
