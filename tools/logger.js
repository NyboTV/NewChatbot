const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const dotenv = require('dotenv');
const colors = require('../lib/colors');
const supportsColor = require('supports-color');

// .env Datei laden
dotenv.config();

class Logger {
    constructor() {
        this.rootDir = path.resolve(__dirname, '..'); // Root-Verzeichnis
        this.logDir = path.join(this.rootDir, 'logs');
        this.botDir = path.join(this.logDir, 'bots');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir);
        }
        if (!fs.existsSync(this.botDir)) {
            fs.mkdirSync(this.botDir);
        }
        this.useColors = process.env.LOG_COLORS === 'true' ? supportsColor.stdout : false;
        this.debugToConsole = process.env.DEBUG === 'true' || process.argv.includes("--debug");
        this.MySQLToConsole = process.env.MYSQL_DEBUG === 'true' || process.argv.includes("--mysql_debug");
    }

    getCurrentTimestamp() {
        const now = new Date();
        const time = now.toTimeString().split(' ')[0]; // hh:mm:ss
        const date = now.toISOString().split('T')[0].split('-').reverse().join('-'); // DD-MM-YYYY
        return `${date} - ${time}`;
    }

    colorize(level, message) {
        if (!this.useColors) return message;
        switch (level) {
            case 'debug':
                return colors.fg.blue + message + colors.reset;
            case 'info':
                return colors.fg.green + message + colors.reset;
            case 'error':
                return colors.fg.red + message + colors.reset;
            case 'directMessages':
                return colors.fg.magenta + message + colors.reset;
            case 'customLog':
                return colors.fg.cyan + message + colors.reset;
            case 'console':
                return message;
            default:
                return message;
        }
    }

    log(level, message, clientName = null, toConsole = false) {
        const timestamp = this.getCurrentTimestamp();
        const logMessage = level == "console" ? `${message}` : `[${timestamp}]-[${level}] ${message}\n`;

        if (clientName) {
            const botLogDir = path.join(this.botDir, clientName);
            if (!fs.existsSync(botLogDir)) {
                fs.mkdirSync(botLogDir);
            }
            fs.appendFileSync(path.join(botLogDir, `${level}.log`), logMessage);

            if(level == 'mysql' && this.MySQLToConsole && (toConsole || this.debugToConsole)) console.log(this.colorize(level, logMessage.trim()))
            if(level != 'mysql' && (toConsole || this.debugToConsole)) console.log(this.colorize(level, logMessage.trim()))

        } else {
            fs.appendFileSync(path.join(this.logDir, `${level}.log`), logMessage);
            if (['info', 'error', 'directMessages', 'customLog', 'console'].includes(level) || (level === 'debug' && this.debugToConsole)) {
                if(level == 'mysql' && this.MySQLToConsole) console.log(this.colorize(level, logMessage.trim()))
                if(level != "mysql") console.log(this.colorize(level, logMessage.trim()))
            }
        }
    }

    debug(message, clientName = null, toConsole = false) {
        this.log('debug', message, clientName, toConsole);
    }

    error(message, clientName = null, toConsole = false) {
        this.log('error', message, clientName, toConsole);
    }

    info(message, clientName = null, toConsole = false) {
        this.log('info', message, clientName, toConsole);
    }

    console(message, clientName = null, toConsole = false) {
        this.log('console', message, clientName, toConsole);
    }

    directMessages(message, clientName = null, toConsole = false) {
        this.log('directMessages', message, clientName, toConsole);
    }

    mysql(message, clientName = null, toConsole = false) {
        this.log('mysql', message, clientName, toConsole);
    }

    customLogger(level) {
        return (message, clientName = null, toConsole = false) => {
            this.log(level, message, clientName, toConsole);
        };
    }

    zipLogs() {
        const logFiles = fs.readdirSync(this.logDir);
        const logGroups = {};

        logFiles.forEach(file => {
            const match = file.match(/(\d{2}-\d{2}-\d{4})/);
            if (match) {
                const date = match[1];
                if (!logGroups[date]) {
                    logGroups[date] = [];
                }
                logGroups[date].push(file);
            }
        });

        Object.keys(logGroups).forEach(date => {
            const output = fs.createWriteStream(path.join(this.logDir, `${date}.zip`));
            const archive = archiver('zip', {
                zlib: {
                    level: 9
                }
            });

            output.on('close', function() {
                console.log(`${archive.pointer()} total bytes`);
                console.log('Archiver has been finalized and the output file descriptor has closed.');
            });

            archive.on('error', function(err) {
                throw err;
            });

            archive.pipe(output);

            logGroups[date].forEach(file => {
                archive.file(path.join(this.logDir, file), {
                    name: file
                });
            });

            archive.finalize();
        });
    }
}

module.exports = new Logger();




/*
// Standard-Logs
logger.debug('This is a debug message');
logger.error('This is an error message');
logger.info('This is an info message');
logger.directMessages('This is a direct message');

// Bot-Logs
logger.info('This is a bot info message', 'botClient1', true);
logger.error('This is a bot error message', 'botClient2');
logger.directMessages('This is a bot direct message', 'botClient3', true);

// Custom Logger für Bots
const botCustomLogger = logger.customLogger('customLog');
botCustomLogger('This is a custom log message for bot', 'botClient4', true);

// ZIP Logs
logger.zipLogs();

*/