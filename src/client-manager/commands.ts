import { SlashCommandBuilder } from '@discordjs/builders';

export enum RealTalkCommand {
  RealTalk = 'realtalk',
}

export enum RealTalkSubcommand {
  History = 'history',
  Quiz = 'quiz',
  Record = 'record',
  RecordBase = 'recordBase',
  Stats = 'stats',
}

const realTalk = new SlashCommandBuilder()
  .setName(RealTalkCommand.RealTalk)
  .setDescription('#RealTalk?')
  .addSubcommand(subcommand =>
    subcommand
      .setName(RealTalkSubcommand.Record)
      .setDescription('Record a #RealTalk statement.')
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
      .setName(RealTalkSubcommand.History)
      .setDescription('List a history of them joints.'))
  .addSubcommand(subcommand =>
    subcommand
      .setName(RealTalkSubcommand.Stats)
      .setDescription('Show me the stats.'))
  .addSubcommand(subcommand =>
    subcommand
      .setName(RealTalkSubcommand.Quiz)
      .setDescription('Quiz us, pls.'));

export default [
  realTalk,
].map(command => command.toJSON());
