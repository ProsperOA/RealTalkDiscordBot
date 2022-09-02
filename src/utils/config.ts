interface Config {
  DonationURL: string;
  DiscordURL: string;
  ServiceName: string;
  IsDev: boolean;
}

export const Config: Readonly<Config> = {
  DonationURL: "https://donate.stripe.com/fZe3d86W0fVZepWeUU",
  DiscordURL: "https://discord.com",
  ServiceName: "RealTalkBot",
  IsDev: process.env.SERVICE_ENV === "dev",
};
