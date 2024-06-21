const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs')
const CommandHandler = require('./lib/handler/commandHandler');
const EventHandler = require('./lib/handler/eventHandler');
const DatabaseManager = require('./lib/database');
const botName = process.argv[2];
const logger = require('./tools/logger');

const clientsDirectory = './_IGNORE_clients'; 
const [clientName, projectName] = process.argv.slice(2)

/*(async () => {
    try {
      

        process.send({ from: clientName, to: 'gamebot', message: `Bot ${clientName} gestartet mit Projekt ${projectName}`, data: { starting: true} });
    } catch (error) {
        console.error('Fehler:', error);
        process.send({ from: clientName, to: 'gamebot', message: `Fehler in Bot ${clientName}: ${error.message}`, data: {} });
    }
  
})();*/

async function initialize() {
    const botDB = await DatabaseManager.getBotDatabaseConnection(botName);
    await botDB.connect();

    if(!fs.existsSync(clientsDirectory)) fs.mkdirSync(clientsDirectory)

    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: `${clientsDirectory}/${clientName}`,
            clientId: clientName
        }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
            args: [
                '--aggressive-cache-discard',
                '--aggressive-tab-discard',
                '--disable-accelerated-2d-canvas',
                '--disable-application-cache',
                '--disable-cache',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-offline-load-stale-cache',
                '--disable-setuid-sandbox',
                '--disk-cache-size=0',
                '--ignore-certificate-errors',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--single-process'
            ],
            executablePath: `/usr/bin/google-chrome-stable`
        }
    });

    logger.info("Starting " + clientName + "...", clientName, false)
    await botDB.updateEntry('bots', { bot: clientName }, { status: "login" });


    logger.info(`Starting [${clientName}]`)
    await addEventHandlers(client, clientName, botDB);
    logger.info(`[${clientName}] Authenticating Bot... `, clientName, false)

    await client.initialize();
    return { client, botDB }
}
initialize()
    .then((client, db) => {
        setup(client, db)
    })
    .catch(error => {
        logger.error('Fehler beim Initialisieren: ' + error, clientName, false);
        process.exit(5);
    });

function addEventHandlers(client, name, db) {
    return new Promise ((resolve, reject) => {
        const gamebot = client
        const clientName = name
        
        const utils = {
            commands,
            botName,
            db,
            speedTestResult,
        }        
        
        logger.info(`Loading QR Event for [${clientName}]...`, clientName, false)
        if(fs.existsSync(path.join(__dirname, 'logs', clientName, `/qr.txt`))) fs.unlinkSync(path.join(__dirname, 'logs', clientName, `/qr.txt`))
        gamebot.on('qr', qr => {
            try {
                db.updateEntry('bots', 'bot', clientName, { status: "error" })

                const event = events.get(`events`)
                event.bot_events.qr_code({qr, clientName, mainDirPath})
            } catch (err) {
                logger.error(`[QR EVENT] Error:` + err)
            }
        });
    
        logger.info(`Loading Ready Event for [${clientName}]...`, clientName, false)
        gamebot.on('ready', async () => {
            try {
                db.updateEntry('bots', 'bot', clientName, { status: 1 })
                const event = events.get(`events`)
                event.bot_events.ready({gamebot, clientName, commands})
            } catch (err) {
                logger.error(`[READY EVENT] Error:` + err)
            }
        })

        logger.info(`Loading Message Event for [${clientName}]...`, clientName, false)
        gamebot.on('message', async chatevent => {
            speedTestResult = {}
            speedTestResult["MessageReceived"] = processTime(chatevent.timestamp, moment())
            try {
                const msgEvent = events.get(`messages`)
                msgEvent.run(gamebot, clientName, chatevent, utils)
            } catch (err) {
                logger.error(`[MESSAGE EVENT] Error:` + err)
            }
        });
    

        // Group Events
        logger.info(`Loading onGroupJoin Event for [${clientName}]...`, clientName, false)
        gamebot.on('group_join', async chatevent => {
            try {
                const groupEvent = events.get(`groups`)
                groupEvent.join(gamebot, clientName, chatevent, utils)
            } catch (err) {
                logger.error(`[JOIN EVENT] Error:` + err)
            }
        })
        
        logger.info(`Loading onGroupLeave Event for [${clientName}]...`, clientName, false)
        gamebot.on('group_leave', async chatevent => {
            try {
                const groupEvent = events.get(`groups`)
                groupEvent.leave(gamebot, clientName, chatevent, utils)
            } catch (err) {
                logger.error(`[LEAVE EVENT] Error:` + err)
            }
        })
        
        logger.info(`Loading onGroupUpdate Event for [${clientName}]...`, clientName, false)
        gamebot.on('group_update', async chatevent => {
            try {
                const groupEvent = events.get(`groups`)
                groupEvent.update(gamebot, clientName, chatevent, utils)
            } catch (err) {
                logger.error(`[UPDATE EVENT] Error:` + err)
            }
        })

        logger.info(`Loading onAdminChanged for [${clientName}]...`, clientName, false)
        gamebot.on('group_admin_changed', async chatevent => {
            try {
                const groupEvent = events.get(`groups`)
                groupEvent.adChanged(gamebot, clientName, chatevent, utils)
            } catch (err) {
                logger.error(`[UPDATE EVENT] Error:` + err)
            }
        })

        logger.info(`Loading onMessageReaction for [${clientName}]...`, clientName, false)
        gamebot.on('message_reaction', async chatevent => {
            try {
                const groupEvent = events.get(`groups`)
                groupEvent.reaction(gamebot, clientName, chatevent, utils)
            } catch (err) {
                logger.error(`[REACTION EVENT] Error:` + err)
            }
        })
    
        logger.info(`Loading onIncomingCall for [${clientName}]...`, clientName, false)
        gamebot.on('incoming_call', async chatevent => {
            try {
                const event = events.get(`events`)
                event.bot_events.incoming_call(gamebot, clientName, chatevent, utils)
            } catch (err) {
                logger.error(`[CALL EVENT] Error:` + err)
            }
        })
    
        logger.info(`Loading onStateChanged for [${clientName}]...`, clientName, false)
        gamebot.on('change_state', async chatevent => {
            try {
                const event = events.get(`events`)
                event.bot_events.state_change({clientName, event: chatevent})
            } catch (err) {
                logger.error(`[STATE EVENT] Error:` + err)
            }
        })

        // Auth Events
        logger.info(`Loading Auth Event for [${clientName}]...`, clientName, false)
        gamebot.on('authenticated', async session => {
            try {
                const event = events.get(`events`)
                event.bot_events.authed({clientName})
            } catch (err) {
                logger.error(`[AUTHED EVENT] Error:` + err)
            }
        });
        gamebot.on('auth_failure', (msg) => {
            try {
                db.updateEntry('bots', 'bot', clientName, { status: "error" })

                const event = events.get(`events`)
                event.bot_events.auth_failed({clientName})
            } catch (err) {
                logger.error(`[AUTH_FAILED EVENT] Error:` + err)
            }
        });
        gamebot.on('disconnected', async (reason) => {
            try {
                db.updateEntry('bots', 'bot', clientName, { status: "error" })

                const event = events.get(`events`)
                event.bot_events.disconnect({reason, clientName})
            } catch (err) {
                logger.error(`[DISCONNECT EVENT] Error:` + err)
            }
        });

        
        resolve()
    })
}


// Verarbeitung eingehender Nachrichten vom übergeordneten Prozess
process.on('message', ({ from, to, message, data }) => {
    console.log(`Nachricht erhalten von ${from}: ${message}`);
    console.log(`Daten:`, data);
    // Aktionen basierend auf empfangener Nachricht und Daten durchführen
});



