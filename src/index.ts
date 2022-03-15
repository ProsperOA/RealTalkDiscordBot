import Bugsnag from '@bugsnag/node';
import { Client, ClientOptions, Intents } from 'discord.js';
import { omit } from 'lodash';

import commandInterface from './client-manager/command-interface';
import { Config, logger } from './utils';

const { CLIENT_TOKEN, BUGSNAG_API_KEY, SERVICE_ENV } = process.env;

const clientOptions: ClientOptions = {
  intents: [
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_PRESENCES,
  ],
  partials: [
    'CHANNEL',
    'MESSAGE',
    'REACTION',
  ]
};

Bugsnag.start({
  apiKey: BUGSNAG_API_KEY,
  logger: omit(logger, 'custom'),
  releaseStage: SERVICE_ENV,
});

export const client: Client = new Client(clientOptions);
commandInterface.init(client);

client.on('ready', (): void => {
  if (Config.IsDev) {
    client.user.setActivity('Development Mode');
  }

  logger.info(`Logged in as ${client.user.tag}`);
});

client.login(CLIENT_TOKEN);
