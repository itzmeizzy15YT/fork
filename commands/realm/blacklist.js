"use strict";

const fs = require("fs");
const path = require("path");

const whitelistPath = path.join(__dirname, "../../data/whitelist.json");

function getData() {
    return JSON.parse(fs.readFileSync(whitelistPath, "utf8"));
}

function saveData(data) {
    fs.writeFileSync(whitelistPath, JSON.stringify(data, null, 4));
}

module.exports = {
    subCommand: "admin",
    data: {
        name: 'blacklist',
        description: 'Blacklist a user from using the bot',

        options: [
            {
                name: "action",
                description: "Add or remove a user",
                type: 3,
                required: true,
                choices: [
                    { name: "Add", value: "add" },
                    { name: "Remove", value: "remove" },
                    { name: "List", value: "list" }
                ]
            },
            {
                name: 'user',
                description: 'The user to blacklist',
                type: 6,
                required: false
            }
        ]
    },
    global: true,
    linkOnly: false,

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const user = interaction.options.getUser('user');
        const data = getData();

        if (!data.authorizedUsers.includes(interaction.user.id)) {
            return interaction.reply({ content: "-# You are not authorized.", flags: 64 });
        }

        if (action === "list") {
            const list = (data.blacklistedUsers || []).map((id, i) => `\`${i + 1}.\` <@${id}>`).join('\n') || "No blacklisted users.";
            return interaction.reply({ content: `### Blacklist\n\n${list}`, flags: 64 });
        }

        if (!user) {
            return interaction.reply({ content: "-# You must specify a user.", flags: 64 });
        }

        if (!data.blacklistedUsers) data.blacklistedUsers = [];

        if (action === "add") {
            if (data.blacklistedUsers.includes(user.id)) {
                return interaction.reply({ content: `-# <@${user.id}> is already blacklisted.`, flags: 64 });
            }
            data.blacklistedUsers.push(user.id);
            saveData(data);
            return interaction.reply({ content: `### Blacklist\n\n<@${user.id}> has been blacklisted.`, flags: 64 });
        }

        if (action === "remove") {
            data.blacklistedUsers = data.blacklistedUsers.filter(id => id !== user.id);
            saveData(data);
            return interaction.reply({ content: `### Blacklist\n\n<@${user.id}> has been removed.`, flags: 64 });
        }
    }
};
