import { SlashCommandBuilder } from '@discordjs/builders';

export const COMMAND_REAL_TALK: Readonly<string> = 'realtalk';
export const SUBCOMMAND_REAL_TALK_RECORD: Readonly<string> = 'record';
export const SUBCOMMAND_REAL_TALK_HISTORY: Readonly<string> = 'history';

const realTalk = new SlashCommandBuilder()
  .setName(COMMAND_REAL_TALK)
  .setDescription('#RealTalk?')
  .addSubcommand(subcommand =>
    subcommand
      .setName(SUBCOMMAND_REAL_TALK_RECORD)
      .setDescription('Record a #RealTalk statement')
      .addUserOption(option =>
        option.setName('who')
          .setDescription('Who they is?')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('what')
          .setDescription('What they said?')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName(SUBCOMMAND_REAL_TALK_HISTORY)
      .setDescription('List all recorded real talk.'));

export default [
  realTalk
].map(command => command.toJSON());
