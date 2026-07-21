const { Client, GatewayIntentBits } = require('discord.js')

const Loader = require('./classes/Loaders')
const config = require('./data/config.json')

require('./functions/Database')

const client = new Client({ intents: Object.values(GatewayIntentBits) })
client.startTime = Date.now()

client.events = new Map()
client.commands = new Map()

client._loader = new Loader(client)
client._loader.loadEvents()

client._channels = config?.channels ?? {}

client.login(config.token)

process.on("uncaughtException", (error) => { console.error("Uncaught Exception:", error); });
process.on("unhandledRejection", (reason, promise) => { console.error("Unhandled Rejection at:", promise, "reason:", reason); });