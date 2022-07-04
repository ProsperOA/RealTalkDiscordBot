import Bugsnag from "@bugsnag/node";
import fetch from "cross-fetch";
import { Client, ClientOptions, Intents } from "discord.js";
import { createApi } from "unsplash-js";
import { omit } from "lodash";

import listeners from "./client/listeners";
import slashCommands from "./client/slash-commands";
import { Config, logger } from "./utils";

const {
  CLIENT_TOKEN,
  BUGSNAG_API_KEY,
  SERVICE_ENV,
  UNSPLASH_API_KEY,
}: NodeJS.ProcessEnv = process.env;

const clientOptions: ClientOptions = {
  intents: [
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
  partials: [
    "CHANNEL",
    "MESSAGE",
    "REACTION",
  ]
};

Bugsnag.start({
  apiKey: BUGSNAG_API_KEY,
  logger: omit(logger, "custom"),
  releaseStage: SERVICE_ENV,
});

export const unsplash = createApi({
  accessKey: UNSPLASH_API_KEY,
  fetch,
});

export const client: Client = new Client(clientOptions);

slashCommands.init(() => listeners.register(client, Config.IsDev));

client.on("ready", (): void => {
  if (Config.IsDev) {
    client.user.setActivity("Development Mode");
  }

  logger.info(`Logged in as ${client.user.tag}`);
});

client.login(CLIENT_TOKEN);
