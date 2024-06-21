const gamebotTables = {
    users: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      email: 'VARCHAR(255) NOT NULL UNIQUE',
      password: 'VARCHAR(255) NOT NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    },
    bots: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      premium: 'BOOLEAN DEFAULT false',
      use_db: 'BOOLEAN DEFAULT false',
      db_host: 'VARCHAR(255)',
      db_user: 'VARCHAR(255)',
      db_password: 'VARCHAR(255)',
      db_name: 'VARCHAR(255)',
      db_port: 'VARCHAR(255)',
      projectName: 'VARCHAR(255)',
      encryption_key: 'VARCHAR(255)',
      add_mode: 'VARCHAR(50)',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      status: 'VARCHAR(50)'
    }
  };
  
  const websiteTables = {
    users: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      username: 'VARCHAR(255) NOT NULL',
      email: 'VARCHAR(255) NOT NULL UNIQUE',
      password: 'VARCHAR(255) NOT NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    },
    // Weitere Tabellen für die Website-Datenbank
  };


  const customBots = {
    users: {
      id: 'INT AUTO_INCREMENT PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      email: 'VARCHAR(255) NOT NULL UNIQUE',
      password: 'VARCHAR(255) NOT NULL',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    },
  }
  
  module.exports = { gamebotTables, websiteTables, customBots };
  




  
  // Beispiele für die MySQL Datentypen
  /*
   * INT: Ein Ganzzahltyp
   * VARCHAR(n): Eine Zeichenkette mit einer maximalen Länge von n
   * BOOLEAN: Ein Wahrheitswert (true/false)
   * TIMESTAMP: Ein Zeitstempel
   * AUTO_INCREMENT: Automatische Inkrementierung des Werts
   * PRIMARY KEY: Primärschlüssel der Tabelle
   * UNIQUE: Eindeutiger Wert
   * NOT NULL: Wert darf nicht NULL sein
   * DEFAULT: Standardwert
   */
  