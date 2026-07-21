module.exports = {
    data: {
        name: 'linkonly',
        description: 'Test link only command!'
    },

    global: true,
    linkOnly: true,
    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), dbUser: import("../../functions/Database.js").User }} param1
     */
    async execute(interaction, { component, flags, dbUser }) {
        dbUser.linkData = "Redacted (prismarine authFlow)." // discord msg limit

        component.text(
            `\`\`\`json\n${JSON.stringify(dbUser, null, 2)}\`\`\``, 
            true
        ).separator()
        await interaction.reply({ components: [component], flags });
    }
}