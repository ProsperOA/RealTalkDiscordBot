interface Config {
  DiscordURL: string;
  ServiceName: string;
  IsDev: boolean;
}

export const Config: Readonly<Config> = {
  DiscordURL: "https://discord.com",
  ServiceName: "RealTalkBot",
  IsDev: process.env.SERVICE_ENV === "dev",
};
