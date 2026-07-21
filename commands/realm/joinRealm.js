const realmAPI = require("../../classes/Realm.js");

module.exports = {
    data: {
        name: "join",
        description: "Accept a minecraft bedrock invite using invite URL.",
        options: [
            {
                name: 'realm',
                description: 'The realm to connect to',
                type: 3,
                required: true,

                min_length: 6,
                max_length: 17
            }
        ]
    },

    subCommand: "realm",
    linkOnly: true,
    global: true,

    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), flags }} helpers
     */     
    async execute(interaction, { component, flags, dbUser }) {
        const input = interaction.options.getString('realm');

        component.text(
            `### Join Realm\n` +
            `Due to crashing's restrictions and to follow Mojangs Terms, please click the button below to accept you want **\`${dbUser.sticky.gamertag}\`** to join the requested realm.\n\n` +
            `-# ***Button interaction will timeout <t:${Math.floor(Date.now() / 1000) + 60}:R>***`
        ).separator()
            .addButtons({
                custom_id: `accept_${interaction.id}`,
                label: null,
                style: 1,
                emoji: { name: "a43df16ec9da46e88cdff7e5f50abcf1", id: "1527635574599450694" },
                text: "Accept Presented Terms"
            })

        const message = await interaction.reply({ components: [component], flags, withResponse: true });

        const response = message.resource.message;

        try {
            const collected = await response.awaitMessageComponent({
                time: 60000,
                max: 1,
                filter: i =>
                    i.user.id === interaction.user.id &&
                    i.customId === `accept_${interaction.id}`
            });

            if (collected.user.id === interaction.user.id && collected.customId === `accept_${interaction.id}`) {
                collected.deferUpdate();

                component.text(
                    `### Join Realm\n` +
                    `Please wait while *crashing* attempts to fetch details for your requested code to join.\n\n` +
                    `-# ***Requested; ${input}*** *[ ${dbUser.sticky.gamertag} ]*`, true
                ).separator()

                await interaction.editReply({ components: [component], flags });

                const realmApi = new realmAPI(dbUser);
                await realmApi.init();

                let realm = /^\d+$/.test(input)
                    ? { body: { errorCode: 890 }, status: 404 }
                    : await realmApi.getRealmInfo(input, false);

                let check = await realmApi.doRealmChecks(realm, null);
                if (check?.errorMsg) {
                    component.text(`### Something went wrong. (RealmAPI C1)\n`, true).separator()
                        .text(`\`   ${check.errorMsg}   \``)

                    return interaction.editReply({ components: [component], flags });
                }

                if (realm.member) {
                    component.text(
                        `### Join Realm\n` +
                        `**${dbUser.sticky.gamertag}** has successfully joined ${realm.name} \`${realm.id}\`, using the invite code ***[${input}](https://www.minecraft.net/en-us/open?inviteCode=${input})***\n\n` +
                        `-# *crashing may make mistakes, we only check membership status nothing else.*`, 
                        true
                    ).separator()

                    return interaction.editReply({ components: [component], flags });
                } else {
                    component.text(
                        `### Join Realm\n` +
                        `**${dbUser.sticky.gamertag}** has failed to join ${realm?.name || "unknown realm"} \`${realm?.id || "unknown id"}\`, using the invite code ***[${input}](https://www.minecraft.net/en-us/open?inviteCode=${input})***\n\n` +
                        `-# *crashing may make mistakes, we only check membership status nothing else.*`, 
                        true
                    ).separator()

                    return interaction.editReply({ components: [component], flags });
                }
            }
        } catch (error) {
            console.error(`${interaction.user.username} ${error?.message || error}`);
            if (error.message.includes("Collector received no interactions before ending with reason: time")) {
                component.components.pop()
                component.addButtons({
                    custom_id: `accept_${interaction.id}`,
                    label: null,
                    style: 1,
                    emoji: { name: "a43df16ec9da46e88cdff7e5f50abcf1", id: "1527635574599450694" },
                    text: "Accept Presented Terms (timeout)",
                    disabled: true
                })

                await interaction.editReply({ components: [component], flags }).catch(() => { })
            }
        }
    }
};