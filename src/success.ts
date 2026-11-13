import type {TGBotConfig, Context} from './interfaces/config';
import * as notifications from './common/notify';
const success = (config: TGBotConfig, context: Context): Promise<void> => notifications.notify('success', config, context);

export {success};
