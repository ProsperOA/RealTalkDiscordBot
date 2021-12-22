import { Client, ClientOptions, Intents } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

import * as commandInterface from './command-interface';

const clientOptions: ClientOptions = {
  intents: [
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES
  ]
};

const client: Client = new Client(clientOptions);;
commandInterface.init(client);

client.on('ready', (): void => {
  console.log(`Logged in as ${client?.user?.tag}`);
});

client.login(process.env.CLIENT_TOKEN);
