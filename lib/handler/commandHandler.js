const fs = require('fs');
const path = require('path');
const logger = require('./tools/logger');

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
    try {
      const commandPath = path.join(__dirname, '..', '..', 'commands');
      await this.loadCommandFiles(commandPath);
      
      const customCommandPath = path.join(commandPath, 'customBots', this.botName);
      if (fs.existsSync(customCommandPath)) {
        await this.loadCommandFiles(customCommandPath);
      }
    } catch (error) {
      logger.error('Error loading commands:', this.client, false);
    }
  }

  async loadCommandFiles(commandPath) {
    try {
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
            logger.debug(`Loaded command: ${command.commandName}`, this.client, false);

            if (commandDetails.aliases) {
              commandDetails.aliases.split(',').forEach(alias => {
                this.aliases.set(alias.trim(), command);
                logger.debug(`Loaded alias: ${alias.trim()} for command: ${command.commandName}`, this.client, false);
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error loading command files:', this.client, false);
    }
  }

  reloadCommands() {
    try {
      this.commands.clear();
      this.aliases.clear();
      this.loadCommands();
    } catch (error) {
      logger.error('Error reloading commands:', this.client, false);
    }
  }

  handle(message, context) {
    try {
      const args = message.body.split(' ');
      const commandName = args.shift().toLowerCase();
      const command = this.commands.get(commandName) || this.aliases.get(commandName);

      if (command) {
        context.args = args;
        command.execute(context);
      } else {
        logger.info(`Command not found: ${commandName}`, this.client, false);
      }
    } catch (error) {
      logger.error('Error handling message:', this.client, false);
    }
  }
}

module.exports = CommandHandler;
