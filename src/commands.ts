export interface Command {
  name: string;
  description: string;
  func: string;
  arg: string;
}

const commands: Command[] = [{
  name: 'realtalk',
  description: 'Replies with #RealTalk?',
  func: 'reply',
  arg: '#RealTalk?'
}];

export default commands;
