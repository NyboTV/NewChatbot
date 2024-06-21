const fs = require('fs');
const path = require('path');

class CommandHandler {
  constructor(client, botName, db) {
    this.client = client;
    this.botName = botName;
    this.db = db;
    this.commands = new Map();
    this.aliases = new Map();
    this.loadCommands();
  }

  async loadCommands() {
    const commandPath = path.join(__dirname, '..', '..', 'commands');
    await this.loadCommandFiles(commandPath);
    
    const customCommandPath = path.join(commandPath, 'customBots', this.botName);
    if (fs.existsSync(customCommandPath)) {
      await this.loadCommandFiles(customCommandPath);
    }
  }

  async loadCommandFiles(commandPath) {
    const commandFiles = fs.readdirSync(commandPath);
    for (const file of commandFiles) {
      const filePath = path.join(commandPath, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        await this.loadCommandFiles(filePath);
      } else if (file.endsWith('.js')) {
        const command = require(filePath);
        const commandDetails = await this.db.findEntry('commands', { commandName: command.commandName });
        
        if (commandDetails && !commandDetails.isDisabled) {
          this.commands.set(command.commandName, command);
          if (commandDetails.aliases) {
            commandDetails.aliases.split(',').forEach(alias => {
              this.aliases.set(alias.trim(), command);
            });
          }
        }
      }
    }
  }

  reloadCommands() {
    this.commands.clear();
    this.aliases.clear();
    this.loadCommands();
  }

  handle(message, context) {
    const args = message.body.split(' ');
    const commandName = args.shift().toLowerCase();
    const command = this.commands.get(commandName) || this.aliases.get(commandName);

    if (command) {
      context.args = args;
      command.execute(context);
    }
  }
}

module.exports = CommandHandler;
