import type {TGBotMessage} from '../interfaces/config';
const defaultFailMessage = (packageName: string | undefined, errors: Error[]): TGBotMessage => ({
 message: `Something went wrong while trying to publish the new version of **${packageName}**!` +
  errors.map(error => `\n\n${error.name}\n${error.message}\n\`\`\`\n${error.stack ?? error.message}\n\`\`\``).join(''),
 format: 'markdown',
});
export {defaultFailMessage};
