"use strict";

const realmAPI = require("../../classes/Realm.js");
const { addRealm, removeRealm, isProtected, getAllProtected } = require("../../functions/whitelist.js");
const { authorizedUsers } = require("../../data/whitelist.json");

module.exports = {
    subCommand: "realm",
    data: {
        name: 'whitelist',
        description: 'Protect a realm from being targeted',

        options: [
            {
                name: "action",
                description: "What to do",
                type: 3,
                required: true,
                choices: [
                    { name: "Add Realm", value: "add" },
                    { name: "Remove Realm", value: "remove" },
                    { name: "List Protected", value: "list" }
                ]
            },
            {
                name: 'realm',
                description: 'The realm code or ID',
                type: 3,
                required: false,
                min_length: 5,
                max_length: 17
            }
        ]
    },
    global: true,
    linkOnly: true,

    async execute(interaction, { component, flags, dbUser }) {
        const action = interaction.options.getString('action');
        const input = interaction.options.getString('realm');

        if (!authorizedUsers.includes(interaction.user.id)) {
            component.text(`### Access Denied\n`, true)
                .separator()
                .text(`\`   You are not authorized to manage whitelists.   \``)

            return interaction.reply({ components: [component], flags });
        }

        if (action === "list") {
            const protectedRealms = await getAllProtected();

            if (protectedRealms.length === 0) {
                component.text(`### Protected Realms\n`, true)
                    .separator()
                    .text(`No realms are currently whitelisted.\n`)

                return interaction.reply({ components: [component], flags });
            }

            component.text(`### Protected Realms\n`, true)
                .separator()
                .text(`**${protectedRealms.length}** realm${protectedRealms.length !== 1 ? 's' : ''} protected:\n`)
                .text(protectedRealms.map((r, i) => `\`${i + 1}.\` \`${r.realmId}\``).join('\n'))

            return interaction.reply({ components: [component], flags });
        }

        if (!input) {
            component.text(`### Whitelist\n`, true)
                .separator()
                .text(`\`   You must specify a realm code or ID.   \``)

            return interaction.reply({ components: [component], flags });
        }

        const RealmAPI = new realmAPI(dbUser);
        await RealmAPI.init();

        let realm = /^\d+$/.test(input)
            ? await RealmAPI.getRealmInfoByID(input)
            : await RealmAPI.getRealmInfo(input, false);

        if (realm?.status || !realm?.id) {
            component.text(`### Whitelist\n`, true)
                .separator()
                .text(`\`   Realm not found or you don't have access.   \``)

            return interaction.reply({ components: [component], flags });
        }

        if (action === "add") {
            await addRealm(realm.id, interaction.user.id);

            component.text(`### Realm Protected\n`, true)
                .separator()
                .text(`**${realm.name}** has been added to the whitelist.\n`)
                .text(`-# Realm ID: \`${realm.id}\``)

            return interaction.reply({ components: [component], flags });
        }

        if (action === "remove") {
            await removeRealm(realm.id);

            component.text(`### Whitelist Removed\n`, true)
                .separator()
                .text(`**${realm.name}** has been removed from the whitelist.\n`)
                .text(`-# Realm ID: \`${realm.id}\``)

            return interaction.reply({ components: [component], flags });
        }
    }
};
