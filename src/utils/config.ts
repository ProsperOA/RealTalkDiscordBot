interface Config {
  ServiceName: string;
  IsDev: boolean;
}

export const Config: Readonly<Config> = {
  ServiceName: 'RealTalkBot',
  IsDev: process.env.SERVICE_ENV === 'dev',
};
