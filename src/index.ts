import { Client, ClientOptions, Intents } from 'discord.js';

import commandInterface from './client-manager/command-interface';
import { isDev, logger } from './utils';

export const SERVICE_NAME: Readonly<string> = 'RealTalkDiscordBot';

const clientOptions: ClientOptions = {
  intents: [
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
  partials: [
    'MESSAGE',
    'CHANNEL',
    'REACTION',
  ]
};

export const client: Client = new Client(clientOptions);
commandInterface.init(client);

client.on('ready', (): void => {
  if (isDev) {
    client.user.setUsername(`${SERVICE_NAME} [DEV]`);
  }

  logger.info(`Logged in as ${client.user.tag}`);
});

client.login(process.env.CLIENT_TOKEN);
