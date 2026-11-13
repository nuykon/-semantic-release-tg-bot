import type {TGBotConfig, Context} from './interfaces/config';
import * as notifications from './common/notify';
const fail = (config: TGBotConfig, context: Context): Promise<void> => notifications.notify('fail', config, context);

export {fail};
