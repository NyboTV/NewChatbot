const fs = require('fs');
const path = require('path');

class EventHandler {
  constructor(client) {
    this.client = client;
    this.loadEvents();
  }

  loadEvents() {
    const eventPath = path.join(__dirname, '..', '..', 'events');
    fs.readdirSync(eventPath).forEach(file => {
      if (file.endsWith('.js')) {
        const event = require(path.join(eventPath, file));
        this.client.on(event.eventName, (...args) => event.execute(...args, this.client));
      }
    });
  }

  reloadEvents() {
    this.loadEvents();
  }
}

module.exports = EventHandler;
