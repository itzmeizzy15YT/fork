module.exports = {
    data: {
        name: 'ping',
        description: 'Test crashing LTD ping!'
    },

    global: true,
    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js") }} param1
     */
    async execute(interaction, { component, flags }) {
        component.text(
            `pong, total ping ${interaction.client.ws.ping}ms, started <t:${Math.floor(interaction.client.startTime / 1000)}:R>.`, 
            true
        ).accent_color = null;
        
        await interaction.reply({ components: [component], flags });
    }
}