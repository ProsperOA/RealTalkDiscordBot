import { config, DotenvConfigOutput } from "dotenv";

const { error }: DotenvConfigOutput = config({ debug: true });

if (error) {
  throw error;
}
