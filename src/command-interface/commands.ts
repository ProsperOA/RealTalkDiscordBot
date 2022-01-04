import { SlashCommandBuilder } from '@discordjs/builders';

const realTalk = new SlashCommandBuilder()
  .setName('realtalk')
  .setDescription('#RealTalk?')
  .addStringOption(option =>
    option.setName('who')
      .setDescription('Who they is?')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('what')
      .setDescription('What they said?')
      .setRequired(true)
  );

const listAllRealTalk = new SlashCommandBuilder()
  .setName('realtalk-list')
  .setDescription('List all recorded real talk.');

export default [
  realTalk,
  listAllRealTalk,
].map(command => command.toJSON());
