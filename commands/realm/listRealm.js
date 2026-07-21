const realmAPI = require("../../classes/Realm.js");

module.exports = {
    data: {
        name: "list",
        description: "List all realms you have access to.",
        options: []
    },

    subCommand: "realm",
    linkOnly: true,
    global: true,

    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), flags }} helpers
     */
    async execute(interaction, { component, flags, dbUser }) {

        component.text(
            `### List Realms\n` +
            `Please wait while crashing formats your realms for your account, **${dbUser.sticky.gamertag}**, this should only take a second!\n\n` +
            `-# *started <t:${Math.floor(Date.now() / 1000)}:R>*`, true
        ).separator()

        await interaction.reply({ components: [component], flags });

        try {
            const realmApi = new realmAPI(dbUser);
            await realmApi.init();

            const realmList = await realmApi.getWorlds();
            if (realmList?.status !== 200) {
                component.text(
                    `### List Realms\n` +
                    `crashing had failed to fetch your realm's list, please attempt this command later or reLink to a new account.\n\n` +
                    `-# *re-running this command may fix the issue, or trying again later!*`,
                    true
                ).separator();

                return interaction.editReply({ components: [component], flags });
            }

            const realms = realmList.body.servers ?? [];
            const perPage = 3;
            const totalPages = Math.max(1, Math.ceil(realms.length / perPage));

            let page = 0;
            let collected;

            while (true) {
                let components = [];

                const start = page * perPage;
                const end = start + perPage;
                const pageRealms = realms.slice(start, end);

                if (pageRealms.length) {
                    for (let i = 0; i < pageRealms.length; i++) {
                        const realm = pageRealms[i];

                        const realmComponent = component.newComponent();
                        realmComponent.text(
                            `### ${realm.name}\n` +
                            `> ID; \`${realm.id}\` (${realm.state})\n` +
                            `> Tier ${realm.tier}`,
                            true
                        );

                        components.push(realmComponent);
                    }
                } else {
                    const empty = component.newComponent();
                    empty.text("You don't have access to any realms.", true);
                    components.push(empty);
                }

                const buttonComponent = component.newComponent();
                buttonComponent.testButton(
                    {
                        type: 2,
                        custom_id: `realm_prev_${interaction.id}`,
                        style: 2,
                        disabled: page === 0,
                        emoji: { name: "smooth_chevron_arrows", id: "1527700499628032100" }
                    },
                    {
                        type: 2,
                        custom_id: `realm_page_${interaction.id}`,
                        label: `${page + 1}/${totalPages}`,
                        style: 2,
                        disabled: true
                    },
                    {
                        type: 2,
                        custom_id: `realm_next_${interaction.id}`,
                        style: 2,
                        disabled: page === totalPages - 1,
                        emoji: { name: "smooth_chevron_arrows", id: "1527700454488674395" }
                    }
                );

                components.push(buttonComponent);

                if (!collected) {
                    await interaction.editReply({ components, flags });
                } else {
                    await collected.update({ components });
                }

                const response = await interaction.fetchReply();

                collected = await response.awaitMessageComponent({
                    time: 60000,
                    filter: i =>
                        i.user.id === interaction.user.id &&
                        (
                            i.customId === `realm_prev_${interaction.id}` ||
                            i.customId === `realm_next_${interaction.id}`
                        )
                }).catch(() => null);

                if (!collected)
                    break;

                if (collected.customId === `realm_prev_${interaction.id}` && page > 0)
                    page--;

                if (collected.customId === `realm_next_${interaction.id}` && page < totalPages - 1)
                    page++;
            }

        } catch (error) {
            console.error(error);

            component.text(
                `### List Realms\n` +
                `crashing had an error while fetching your realm's list, please attempt this command later or reLink to a new account.\n\n`,
                true
            ).separator();

            return interaction.editReply({ components: [component], flags });
        }
    }
};
