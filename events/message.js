const { executeCommand } = require('./commandHandler');
const db = require('./db'); // Importieren Sie Ihre DB-Verbindung oder das Modul, das DB-Operationen ausführt

module.exports = async (message) => {
    try {
        // Ihre Logik zum Verarbeiten der Nachricht
        const user = await db.getUser(message.author.id);
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Globale Array für den Command-Handler
        const globalArray = {
            message,
            language: user.language,
            db,
            clientName: 'YourClientName',
            WebSocketClient: 'YourWebSocketClient',
            args
        };

        // Command ausführen
        await executeCommand(commandName, globalArray);
    } catch (error) {
        console.error('Error handling message:', error);
    }
};
