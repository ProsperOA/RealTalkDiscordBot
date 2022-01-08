const { SERVICE_ENV } = process.env;

export const isDev: Readonly<boolean> = SERVICE_ENV === 'dev';
