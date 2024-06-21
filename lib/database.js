const mysql = require('mysql2/promise');
const crypto = require('crypto');
const dotenv = require('dotenv');
const logger = require('../tools/logger');
const {
    gamebotTables,
    websiteTables,
    customBots
} = require('./layouts/dbTables');

dotenv.config();

const connectionConfigGamebot = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_GAMEBOT,
    port: process.env.DB_PORT || 3306 // Optionaler Port, Standard ist 3306
};

const connectionConfigWebsite = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_WEBSITE,
    port: process.env.DB_PORT || 3306 // Optionaler Port, Standard ist 3306
};

const SECRET_KEY = process.env.SECRET_KEY;

const verifiedDatabases = new Set(); // Set zum Nachverfolgen der überprüften Datenbanken

class MySQL {
    constructor(connectionConfig, botName, encryptionKey = SECRET_KEY) {
        this.connectionConfig = connectionConfig;
        this.encryptionKey = encryptionKey;
        this.botName = botName; // Botname speichern
        this.queue = [];
        this.processing = false;
    }



    async connect() {
        try {
            if (!this.connection) {
                this.connection = await mysql.createConnection(this.connectionConfig);

                // Überprüfen, ob die richtige Bot-Datenbank verwendet wird
                if ((this.connectionConfig.database === process.env.DB_DATABASE_GAMEBOT && this.botName.toLowerCase() !== 'gamebot') ||
                    (this.connectionConfig.database === process.env.DB_DATABASE_WEBSITE && this.botName.toLowerCase() !== 'website')) {
                    return this.connection;
                }

                const dbName = this.connectionConfig.database;
                if (!verifiedDatabases.has(dbName)) {
                    await this.verifyAndAlterTables();
                    verifiedDatabases.add(dbName);
                }
            }
            return this.connection;
        } catch (error) {
            logger.error(`Database connection failed: ${error.message}\n${error.stack}`);
            process.exit(51); // Exit the process if the database connection fails
        }
    }

    async verifyAndAlterTables() {
        try {
            const connection = await this.connect();
            let tableDefinitions;

            if (this.botName.toLowerCase() === 'gamebot') {
                tableDefinitions = gamebotTables;
            } else if (this.botName.toLowerCase() === 'website') {
                tableDefinitions = websiteTables;
            } else {
                tableDefinitions = customBots;
            }

            const verifiedTables = new Set();

            for (const [tableName, columns] of Object.entries(tableDefinitions)) {
                if (!verifiedTables.has(tableName)) {
                    try {
                        await this.createOrUpdateTable(connection, tableName, columns);
                        verifiedTables.add(tableName);
                    } catch (error) {
                        console.error(`Fehler beim Überprüfen der Tabelle ${tableName}: ${error.message}\n${error.stack}`);
                    }
                }
            }
        } catch (error) {
            logger.mysql(`Fehler beim Überprüfen und Ändern der Tabellen: ${error.message}\n${error.stack}`);
        }
    }

    async createOrUpdateTable(connection, tableName, columns) {
        try {
            const [rows] = await connection.query(`SHOW TABLES LIKE ?`, [tableName]);
            if (rows.length === 0) {
                const columnsDef = Object.entries(columns).map(([col, type]) => `${col} ${type}`).join(', ');
                const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDef})`;
                await connection.query(query);
                logger.info(`Tabelle ${tableName} erstellt.`, (["gamebot", "website"].includes(this.botName.toLowerCase()) ? null : this.botName));
            } else {
                const existingColumns = await this.getExistingColumns(connection, tableName);
                const columnOrder = Object.keys(columns);

                for (const [colName, colDef] of Object.entries(columns)) {
                    const existingColDef = existingColumns[colName];
                    const isPrimaryKey = colDef.includes('PRIMARY KEY');
                    const isAutoIncrement = colDef.includes('AUTO_INCREMENT');
                    const isUnique = colDef.includes('UNIQUE');

                    if (!existingColumns[colName]) {
                        await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
                        logger.mysql(`Spalte ${colName} zur Tabelle ${tableName} hinzugefügt.`, (["gamebot", "website"].includes(this.botName.toLowerCase()) ? null : this.botName));
                    } else {
                        if (isPrimaryKey && existingColDef.includes('PRIMARY KEY')) {
                            continue;
                        }
                        if (isAutoIncrement && existingColDef.includes('AUTO_INCREMENT')) {
                            continue;
                        }
                        if (isUnique && existingColDef.includes('UNIQUE')) {
                            continue;
                        }
                        if (existingColDef.split(' ')[0] !== colDef.split(' ')[0]) { 
                            await connection.query(`ALTER TABLE ${tableName} MODIFY COLUMN ${colName} ${colDef}`);
                            logger.mysql(`Spalte ${colName} in der Tabelle ${tableName} geändert.`, (["gamebot", "website"].includes(this.botName.toLowerCase()) ? null : this.botName));
                        }
                    }
                }

                for (let i = 0; i < columnOrder.length; i++) {
                    if (columns[columnOrder[i]].includes('PRIMARY KEY') || columns[columnOrder[i]].includes('AUTO_INCREMENT') || columns[columnOrder[i]].includes('UNIQUE')) {
                        continue;
                    }

                    if (i === 0) {
                        await connection.query(`ALTER TABLE ${tableName} MODIFY COLUMN ${columnOrder[i]} ${columns[columnOrder[i]]} FIRST`);
                    } else {
                        await connection.query(`ALTER TABLE ${tableName} MODIFY COLUMN ${columnOrder[i]} ${columns[columnOrder[i]]} AFTER ${columnOrder[i - 1]}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Fehler in createOrUpdateTable für ${tableName}: ${error.message}\n${error.stack}`);
            throw error;
        }
    }

    async getExistingColumns(connection, tableName) {
        const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
        const columns = {};
        rows.forEach(row => {
            let columnDef = row.Type.toLowerCase();
            if (row.Extra) {
                columnDef += ` ${row.Extra}`;
            }
            if (row.Key === 'PRI') {
                columnDef += ' PRIMARY KEY';
            }
            if (row.Key === 'UNI') {
                columnDef += ' UNIQUE';
            }
            columns[row.Field] = columnDef;
        });
        return columns;
    }




    encrypt(text, callback) {
        try {
            if (!this.encryptionKey) {
                if (callback) {
                    callback(null, text);
                } else {
                    return Promise.resolve(text);
                }
            } else {
                const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
                let encrypted = cipher.update(text, 'utf8', 'hex');
                encrypted += cipher.final('hex');
                if (callback) {
                    callback(null, encrypted);
                } else {
                    return Promise.resolve(encrypted);
                }
            }
        } catch (error) {
            logger.mysql(`Encryption failed: ${error.message}\n${error.stack}`);
            if (callback) {
                callback(error, null);
            } else {
                return Promise.reject(error);
            }
        }
    }

    decrypt(text, callback) {
        try {
            if (!this.encryptionKey) {
                if (callback) {
                    callback(null, text);
                } else {
                    return Promise.resolve(text);
                }
            } else {
                const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
                let decrypted = decipher.update(text, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                if (callback) {
                    callback(null, decrypted);
                } else {
                    return Promise.resolve(decrypted);
                }
            }
        } catch (error) {
            logger.mysql(`Decryption failed: ${error.message}\n${error.stack}`);
            if (callback) {
                callback(error, null);
            } else {
                return Promise.reject(error);
            }
        }
    }

    async createTable(tableName, columns, callback) {
        try {
            const connection = await this.connect();
            const columnsDef = Object.entries(columns).map(([col, type]) => `${col} ${type}`).join(', ');
            const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDef})`;
            await connection.query(query);
            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(`Create table failed: ${error.message}\n${error.stack}`);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Check if a table exists
     * Example: const exists = await db.tableExists('users', callback);
     */
    async tableExists(tableName, callback) {
        try {
            const connection = await this.connect();
            const [rows] = await connection.query("SHOW TABLES LIKE ?", [tableName]);
            if (callback) {
                callback(null, rows.length > 0);
            } else {
                return rows.length > 0;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Drop a table
     * Example: await db.dropTable('users', callback);
     */
    async dropTable(tableName, callback) {
        try {
            const connection = await this.connect();
            await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Alter a table
     * Example: await db.alterTable('users', 'ADD', 'age', 'INT', callback);
     */
    async alterTable(tableName, action, columnName, columnType, callback) {
        try {
            const connection = await this.connect();
            const query = `ALTER TABLE ${tableName} ${action} ${columnName} ${columnType}`;
            await connection.query(query);
            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Add a new entry to a table
     * Example: await db.addEntry('users', { name: 'John Doe', email: 'john@example.com', password: db.encrypt('password123') }, callback);
     */
    async addEntry(tableName, entry, callback) {
        try {
            const connection = await this.connect();
            const columns = Object.keys(entry).join(", ");
            const placeholders = Object.keys(entry).map(() => "?").join(", ");
            const values = Object.values(entry);

            const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

            await connection.execute(query, values);

            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }


    /**
     * Delete an entry from a table
     * Example: await db.deleteEntry('users', { email: 'john@example.com' }, callback);
     */
    async deleteEntry(tableName, criteria, callback) {
        try {
            const connection = await this.connect();
            const columns = Object.keys(criteria).map((key) => `${key} = ?`).join(" AND ");
            const values = Object.values(criteria);
            await connection.execute(`DELETE FROM ${tableName} WHERE ${columns}`, values);
            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Update an entry in a table
     * Example: await db.updateEntry('users', { email: 'john@example.com' }, { name: 'Jane Doe' }, callback);
     */
    async updateEntry(tableName, criteria, updates, callback) {
        try {
            const connection = await this.connect();
            const setClause = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
            const whereClause = Object.keys(criteria).map((key) => `${key} = ?`).join(" AND ");
            const values = [...Object.values(updates), ...Object.values(criteria)];
            await connection.execute(
                `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`,
                values
            );
            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Find an entry in a table
     * Example: const user = await db.findEntry('users', { email: 'john@example.com' }, callback);
     */
    async findEntry(tableName, criteria, callback) {
        try {
            const connection = await this.connect();
            const columns = Object.keys(criteria).map((key) => `${key} = ?`).join(" AND ");
            const values = Object.values(criteria);
            const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE ${columns}`, values);
            if (callback) {
                callback(null, rows.length > 0 ? rows[0] : false);
            } else {
                return rows.length > 0 ? rows[0] : false;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Find multiple entries in a table
     * Example: const users = await db.findEntries('users', { name: 'John Doe' }, callback);
     */
    async findEntries(tableName, criteria, callback) {
        try {
            const connection = await this.connect();
            const columns = Object.keys(criteria).map((key) => `${key} = ?`).join(" AND ");
            const values = Object.values(criteria);
            const [rows] = await connection.execute(`SELECT * FROM ${tableName} WHERE ${columns}`, values);
            if (callback) {
                callback(null, rows.length > 0 ? rows : false);
            } else {
                return rows.length > 0 ? rows : false;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Get all databases
     * Example: const databases = await db.getAllDatabases(callback);
     */
    async getTableAsJSON(tableName, callback) {
        try {
            const connection = await this.connect();
            const [rows] = await connection.query(`SELECT * FROM ??`, [tableName]);
            if (callback) {
                callback(null, rows);
            } else {
                return rows;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Backup the database
     * Example: await db.backupDatabase(callback);
     */
    async backupDatabase(callback) {
        try {
            const connection = await this.connect();
            const tables = await connection.query("SHOW TABLES");
            const databaseName = this.connectionConfig.database;
            const backupDir = path.join(__dirname, `../backups/${databaseName}`);
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, {
                    recursive: true
                });
            }
            for (const table of tables[0]) {
                const tableName = table[`Tables_in_${databaseName}`];
                const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
                fs.writeFileSync(
                    path.join(backupDir, `${tableName}.json`),
                    JSON.stringify(rows, null, 2)
                );
            }
            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Reset auto increment value of a table
     * Example: await db.resetAutoIncrement('users', callback);
     * Example with reordering: await db.resetAutoIncrement('users', true, callback);
     */
    async resetAutoIncrement(tableName, reorder = false, callback) {
        try {
            const connection = await this.connect();
            if (reorder) {
                const [rows] = await connection.query(`SELECT * FROM ${tableName} ORDER BY id`);
                const promises = rows.map((row, index) => {
                    return connection.query(`UPDATE ${tableName} SET id = ? WHERE id = ?`, [index + 1, row.id]);
                });
                await Promise.all(promises);
            }
            await connection.query(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);
            if (callback) {
                callback(null, true);
            } else {
                return true;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    /**
     * Check for duplicate entries in a table
     * Example: const duplicates = await db.checkForDuplicates('users', ['email'], callback);
     */
    async checkForDuplicates(tableName, columns, callback) {
        try {
            const connection = await this.connect();
            const columnList = columns.join(", ");
            const query = `SELECT ${columnList}, COUNT(*) as count FROM ${tableName} GROUP BY ${columnList} HAVING count > 1`;
            const [rows] = await connection.query(query);
            if (callback) {
                callback(null, rows.length > 0 ? rows : false);
            } else {
                return rows.length > 0 ? rows : false;
            }
        } catch (error) {
            logger.mysql(error.message, this.botName, false);
            if (callback) {
                callback(error, false);
            } else {
                return false;
            }
        }
    }

    async verifyTables() {
        await this.verifyAndAlterTables();
    }
}

class DatabaseManager {
    static gamebot = new MySQL(connectionConfigGamebot, 'gamebot');
    static website = new MySQL(connectionConfigWebsite, 'website');
    static botConnections = {};

    static async getBotDatabaseConnection(botName) {
        if (!this.botConnections[botName]) {
            const connectionConfig = await this.getBotConnectionConfig(botName);
            const encryptionKey = await this.getBotEncryptionKey(botName);
            this.botConnections[botName] = new MySQL(connectionConfig, botName, encryptionKey);
        }
        return this.botConnections[botName];
    }

    static async getBotConnectionConfig(botName) {
        try {
            if (botName.toLowerCase() === 'gamebot') {
                return connectionConfigGamebot;
            } else if (botName.toLowerCase() === 'website') {
                return connectionConfigWebsite;
            }

            const connection = await this.gamebot.connect();
            const [rows] = await connection.execute('SELECT * FROM bots WHERE name = ?', [botName]);
            if (rows.length === 0) {
                throw new Error('Bot not found');
            }
            const bot = rows[0];
            if (bot.premium) {
                return {
                    host: bot.db_host,
                    user: bot.db_user,
                    password: bot.db_password,
                    database: bot.db_name,
                    port: bot.db_port || 3306 // Optionaler Port, Standard ist 3306
                };
            } else {
                return connectionConfigGamebot;
            }
        } catch (error) {
            logger.error(`Error retrieving bot connection config: ${error.message}\n${error.stack}`);
            process.exit(51);
        }
    }

    static async getBotEncryptionKey(botName) {
        try {
            if (botName.toLowerCase() === 'gamebot' || botName.toLowerCase() === 'website') {
                return SECRET_KEY;
            }

            const connection = await this.gamebot.connect();
            const [rows] = await connection.execute('SELECT encryption_key FROM bots WHERE name = ?', [botName]);
            if (rows.length === 0) {
                throw new Error('Bot not found');
            }
            const bot = rows[0];
            return bot.encryption_key || null;
        } catch (error) {
            logger.error(`Error retrieving bot encryption key: ${error.message}\n${error.stack}`);
            process.exit(51);
        }
    }
}

module.exports = DatabaseManager;