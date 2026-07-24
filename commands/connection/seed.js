"use strict";

const { EmbedBuilder } = require("discord.js");
const realmAPI = require("../../classes/Realm.js");
const createInstance = require("../../functions/client.js");
const { isProtected } = require("../../functions/whitelist.js");
const { getErrorMessage, errorEmbed } = require("../../functions/errors.js");

module.exports = {
    subCommand: null,
    data: {
        name: 'seed',
        description: 'Get the seed of a realm',

        options: [
            {
                name: 'realm',
                description: 'The realm to get the seed from',
                type: 3,
                required: true,
                min_length: 6,
                max_length: 17
            }
        ]
    },
    global: true,
    linkOnly: true,

    async execute(interaction, { component, flags, dbUser }) {
        const input = interaction.options.getString('realm');

        await interaction.deferReply();

        const embed = new EmbedBuilder()
            .setTitle("Seed")
            .setDescription(`Resolving realm...\n-# Input: \`${input}\``)
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
                    embeds: [errorEmbed("Seed", null, getErrorMessage({ errorMsg: `${realm.body?.errorMsg || 'Unknown'} ${realm.body?.errorCode || realm.status}` }))]
                });
            }

            if (realm?.body?.errorMsg) {
                return interaction.editReply({
                    embeds: [errorEmbed("Seed", null, getErrorMessage(realm.body))]
                });
            }

            if (realm?.body) realm = realm.body;

            if (realm?.state === "CLOSED" || realm?.closed) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", realm, "Realm is closed")] });
            }

            if (realm?.expired) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", realm, "Realm is expired")] });
            }

            if (!realm || !realm.id) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", null, "Realm not found")] });
            }

            const alreadyProtected = await isProtected(realm.id).catch(() => false);
            if (alreadyProtected) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", realm, "Whitelisted")] });
            }

            let check = await RealmAPI.doRealmChecks(realm, null);
            if (check?.errorMsg) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", realm, getErrorMessage(check))] });
            }

            let host;
            for (let attempt = 0; attempt < 5; attempt++) {
                host = await RealmAPI.getRealmIP(realm.id);
                
                if (host.status === 429) {
                    const waitTime = (attempt + 1) * 5000;
                    console.log(`[seed] Rate limited, retrying in ${waitTime / 1000}s... (attempt ${attempt + 1}/5)`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                break;
            }

            if (host?.status === 403) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", realm, "You are banned from this realm")] });
            }

            check = await RealmAPI.doRealmChecks(null, host);
            if (check?.errorMsg) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", realm, getErrorMessage(check))] });
            }

            const connectingEmbed = new EmbedBuilder()
                .setTitle("Seed")
                .setDescription(`**${realm.name}** · \`${realm.id}\`\n-# Connecting to extract seed...`)
                .setColor(0xFACC15);
            await interaction.editReply({ embeds: [connectingEmbed] });

            const seed = await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    actualClient?.disconnect?.();
                    resolve(null);
                }, 30000);

                let resolved = false;

                const options = {
                    protocol: host.body.networkProtocol,
                    address: host.body.address,
                    external: { enabled: false, type: 0 },
                    hangConnection: true
                };

                const client = createInstance(realm, dbUser, options, RealmAPI);

                (client.then ? client : Promise.resolve(client)).then((c) => {
                    const actualClient = Array.isArray(c) ? c[0] : c;

                    actualClient.on('start_game', (data) => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeout);

                        let seedValue = data.world_seed
                            || data.seed
                            || data.worldSeed
                            || data.level_seed;

                        if (seedValue !== undefined && seedValue !== null) {
                            seedValue = BigInt(seedValue);
                            
                            if (seedValue > 9223372036854775807n) {
                                seedValue = seedValue - 18446744073709551616n;
                            }
                        }

                        actualClient.disconnect();
                        resolve(seedValue);
                    });

                    actualClient.on('kick', () => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(null);
                    });

                    actualClient.on('close', () => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(null);
                    });

                    actualClient.on('error', () => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeout);
                        resolve(null);
                    });
                });
            });

            if (!seed && seed !== 0n) {
                return interaction.editReply({ embeds: [errorEmbed("Seed", realm, "Connection failed")] });
            }

            const seedStr = seed.toString();
            const chunkbaseUrl = `https://www.chunkbase.com/apps/seed-map#seed=${seedStr}&platform=bedrock_1_21&dimension=overworld`;

            const doneEmbed = new EmbedBuilder()
                .setTitle("Seed")
                .setDescription(`**${realm.name}** · \`${realm.id}\`\n-# Seed: \`${seedStr}\`\n-# [View on Chunkbase](${chunkbaseUrl})`)
                .setColor(0x4ADE80);
            return interaction.editReply({ embeds: [doneEmbed] });

        } catch (error) {
            console.error('[seed] Fatal error:', error);
            return interaction.editReply({ embeds: [errorEmbed("Seed", null, "Unknown error")] }).catch(() => {});
        }
    }
};
