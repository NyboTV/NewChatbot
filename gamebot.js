require('dotenv').config();
const logger = require('./tools/logger');
const figlet = require('figlet');
const DatabaseManager = require('./lib/database');
const { fork } = require('child_process');
const localhost = process.argv.includes("--localhost");

logger.console(figlet.textSync('Gamebot', 'Larry 3D'));

const clientProcesses = {};

(async () => {
    try {
        const db = DatabaseManager.gamebot;
        await db.connect();
        
        const botsData = await db.getTableAsJSON('bots'); // Fetch bot data from the "bots" database
        const clients = botsData; // Assuming botsData is already parsed as JSON

        for (const client of clients) {
            await startBot(client.name, (client.projectName ? client.projectName : "Gamebot"), localhost);
        }
    } catch (error) {
        console.error('Fehler:', error);
    }
})();

async function startBot(botName, projectName, localhost) {
    return new Promise((resolve, reject) => {
        const clientProcess = fork('./bot.js', [botName, projectName, localhost, ...process.argv.slice(2)]);
        let restartAttempts = 0;
        const maxAttempts = 5;

        logger.info(`[START] Starting Bot "${botName}"...`)

        clientProcess.on('spawn', () => {
            resolve(true);
        });

        clientProcess.on('message', (message) => {
            if(!message) return

            if(message.data.starting == true) {
                logger.info(`[START] ${message.message}`)
                return
            } 
            console.log(`Nachricht von ${botName} erhalten:`, message);
        });

        clientProcess.on('error', (error) => {
            logger.error(`Fehler in Bot ${botName}: ${error.message}`, botName, false);
            reject(error);
        });

        clientProcess.on('exit', (code) => {
            switch (code) {
                case "1":
                case 1:
                    logger.info(`Unerwarteter Fehler hat Bot ${botName} gestoppt. Neustart in 5 Sekunden...`, botName, false);
                    if (restartAttempts < maxAttempts) {
                        restartAttempts++;
                        setTimeout(() => startBot(botName, projectName), 5000);
                    } else {
                        logger.error(`Bot ${botName} konnte nach ${maxAttempts} Versuchen nicht neu gestartet werden.`, botName, false);
                    }
                    break;

                case "5":
                case 5:
                    logger.info(`Unerwarteter Fehler hat Bot ${botName} gestoppt.`, botName, false);
                    break;
                
                case "10":
                case 10:
                    logger.info(`Bot ${botName} wurde automatisch neu gestartet.`, botName, false);
                    startBot(botName, projectName);
                    break;
                
                case "30":
                case 30:
                    logger.info(`Bot ${botName} wurde manuell gestoppt.`, botName, false);
                    break;
                
                case "51":
                case 51:
                    logger.info(`MySQL-Verbindungsfehler bei Bot ${botName}.`, botName, false);
                    break;

                default:
                    logger.info(`Bot ${botName} wurde mit Code ${code} beendet.`, botName, false);
            }
        });

        clientProcesses[botName] = clientProcess;
    });
}

// Funktion zum Senden einer Nachricht an einen bestimmten Bot
function sendMessageToBot(botName, message, data = {}) {
    if (clientProcesses[botName]) {
        const msg = { from: 'gamebot', to: botName, message, data };
        clientProcesses[botName].send(msg);
    } else {
        console.error(`Bot ${botName} nicht gefunden`);
    }
}

// Funktion zum Senden einer Nachricht an alle Bots
function sendMessageToAllBots(message, data = {}) {
    const msg = { from: 'gamebot', to: 'all', message, data };
    for (let name in clientProcesses) {
        clientProcesses[name].send(msg);
    }
}

/*
// Beispielverwendung
setTimeout(() => {
    sendMessageToBot('Bot1', 'Hallo Bot1', { value1: 123, value2: 'Beispiel' });
    sendMessageToAllBots('Hallo alle Bots', { value1: 456, value2: 'Beispiel' });
}, 5000);
*/
