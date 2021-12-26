const { SERVICE_ENV } = process.env;

export const isDev: Readonly<boolean> = SERVICE_ENV === 'dev';
export const isProd: Readonly<boolean> = SERVICE_ENV === 'prod';
