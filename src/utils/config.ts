interface Config {
  DiscordURL: string;
  ChannelsURL: string;
  ServiceName: string;
  IsDev: boolean;
}

export const Config: Readonly<Config> = {
  DiscordURL: 'https://discord.com',
  ChannelsURL: 'https://discord.com/channels',
  ServiceName: 'RealTalkBot',
  IsDev: process.env.SERVICE_ENV === 'dev',
};
