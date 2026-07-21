module.exports = {
    data: {
        name: "out",
        description: "Opt out of crashing, removing your account from our system"
    },
    subCommand: "opt",
    global: true,
    linkOnly: true,
    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), dbUser: import("../../functions/Database.js").User }} param1
     */
    async execute(interaction, { component, flags, dbUser }) {
        try {
            const gamertag = dbUser.sticky.gamertag
            // await clearLink(dbUser);
            await dbUser.deleteOne({ id: dbUser.id });

            component.text(
                `### Opt-Out\n` +
                `crashing-ltd has unlinked ***\`${gamertag}\`*** from your account, if you would like to relink please run \`/opt in\`!\n\n` +
                `-# **crashing still has some data on you, this will clear in a few days if you dont relink!**`,
                true
            ).separator()
            await interaction.reply({ components: [component], flags });
        }
        catch (error) {
            console.error(error);

            await clearLink(dbUser);

            component.text(error?.message ?? "An unknown error occurred while linking.", true);
            return interaction.reply({ components: [component], flags });
        }
    }
}

const clearLink = async (user) => {
    user.linked = false;
    user.sticky.xuid = null;
    user.sticky.gamertag = null;
    user.linkData = {};

    await user.save();
}