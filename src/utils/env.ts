import { config, DotenvConfigOptions } from 'dotenv';

const { SERVICE_ENV } = process.env;

type ServiceEnv = 'dev' | 'prod';

export const isDev: Readonly<boolean> = SERVICE_ENV === 'dev';
export const isProd: Readonly<boolean> = SERVICE_ENV === 'prod';

/**
 * Configures environment variables.
 *
 * @param {ServiceEnv}          serviceEnv - current service environment.
 * @param {DotenvConfigOptions} options    - dotenv options.
 */
export const configEnv = (
  serviceEnv?: ServiceEnv,
  options?: DotenvConfigOptions
): void => {
  if (SERVICE_ENV === serviceEnv) {
    config(options);
  }
};
