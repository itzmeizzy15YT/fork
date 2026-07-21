const fs = require('fs')
const { REST, Routes } = require('discord.js')

class Loader {
    constructor(client, log = () => { }) {
        this.client = client;
        this.loaded = { commands: false, events: false };
        this.log = log;
    }

    getFiles(base, ignore = []) {
        return fs.readdirSync(base)
            .filter(folder => !ignore.includes(folder))
            .flatMap(folder =>
                fs.readdirSync(`${base}/${folder}`)
                    .filter(file => file.endsWith(".js"))
                    .map(file => `${base}/${folder}/${file}`)
            );
    }

    async loadCommands() {
        if (this.loaded.commands) return "Commands have already been loaded.";

        const grouped = new Map();

        for (const file of this.getFiles(`${__dirname}/../commands`, ["_"])) {
            const cmd = require(file);

            cmd.data ??= { name: String(Math.random()).slice(2), description: "Not set." };
            cmd.execute ??= (i => i?.reply?.("### -# **This command has not been added yet, please wait until it is added before using it!**") ?? null);

            this.client.commands.set(cmd.data.name, cmd);

            if (!cmd.subCommand) continue;

            if (!grouped.has(cmd.subCommand)) {
                grouped.set(cmd.subCommand, {
                    name: cmd.subCommand,
                    description: `${cmd.subCommand} commands`,
                    global: cmd.global,
                    options: []
                });
            }

            const group = grouped.get(cmd.subCommand);

            group.global ||= cmd.global;

            group.options.push({
                type: 1,
                name: cmd.data.name,
                description: cmd.data.description,
                options: cmd.data.options ?? []
            });
        }

        const body = [];
        for (const cmd of this.client.commands.values()) {
            if (cmd.subCommand) continue;

            body.push({
                ...cmd.data,
                type: 1,
                contexts: cmd.global ? [0, 1, 2] : [0],
                dm_permission: true
            });
        }

        for (const group of grouped.values()) {
            body.push({
                name: group.name,
                description: group.description,
                type: 1,
                contexts: group.global ? [0, 1, 2] : [0],
                dm_permission: true,
                options: group.options
            });
        }

        await new REST({ version: "10" })
            .setToken(this.client.token)
            .put(Routes.applicationCommands(this.client.user.id), { body });

        this.log(`[info] ${this.client.commands.size} commands loaded`);
        this.loaded.commands = true;

        return true;
    }

    loadEvents() {
        if (this.loaded.events) return "Events have already been loaded."

        for (const file of this.getFiles(`${__dirname}/../events`)) {
            const evt = require(file)

            this.client.events.set(evt.name, evt)

            const listener = evt.once ? this.client.once.bind(this.client) : this.client.on.bind(this.client)
            listener(evt.name, (...args) => { evt.execute(...args, this.client) })
            this.log(`[debug] loaded event: ${evt.name} (once?; ${evt.once})`)
        }

        this.log(`[info] loaded ${this.client.events.size} events`)
        this.loaded.events = true

        return true;
    }
}

module.exports = Loader