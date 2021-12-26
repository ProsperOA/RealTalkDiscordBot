import { Client, ClientOptions, Intents } from 'discord.js';

import commandInterface from './command-interface';
import logger from './utils/logger';

const clientOptions: ClientOptions = {
  intents: [
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
  ],
};

const client: Client = new Client(clientOptions);
commandInterface.init(client);

client.on('ready', (): void => {
  logger.info(`Logged in as ${client.user.tag}`);
});

client.login(process.env.CLIENT_TOKEN);
