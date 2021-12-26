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

export default [
  realTalk
].map(command => command.toJSON());
