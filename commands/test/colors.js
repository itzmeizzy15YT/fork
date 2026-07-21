module.exports = {
    data: {
        name: "colors",
        description: "Test a set of colors."
    },

    global: true,
    staffOnly: true,

    /**
     * @param {import("discord.js").CommandInteraction} interaction
     * @param {{ component: import("../../classes/Component.js"), flags }} helpers
     */
    async execute(interaction, { component, flags }) {
        const colors = new Map([
            ["Powder Blue", 0xBFDFFF],
            ["Baby Blue", 0xBFE7FF],
            ["Sky Mist", 0xCFEFFF],
            ["Ice Blue", 0xD6F3FF],
            ["Light Azure", 0xD9ECFF],
            ["Pale Sky", 0xDCEEFF],
            ["Cloud Blue", 0xE3F2FD],
            ["Morning Blue", 0xD7EBFF],
            ["Robin Egg", 0xC6EAFD],
            ["Bluebell", 0xC9DAF8],
            ["Periwinkle Blue", 0xC7CEEA],
            ["Cornflower Mist", 0xC8DFFF],
            ["Arctic Blue", 0xE1F5FE],
            ["Frost Blue", 0xE8F4FF],
            ["Soft Cyan", 0xD8F8FF],
            ["Mint Blue", 0xD4F1F9],
            ["Aqua Mist", 0xD9F7FF],
            ["Glacier", 0xCCEFFF],
            ["Crystal Blue", 0xD6F0FF],
            ["Serenity", 0xAFCBFF]
        ]);

        const components = [];

        for (const [name, color] of colors) {
            const embed = component.newComponent();

            embed.text(
                `### ${name}\n` +
                `\`  0x${color.toString(16).toUpperCase().padStart(6, "0")}  \``,
                true
            );

            embed.accent_color = color;
            components.push(embed);
        }

        await interaction.reply({ components, flags });
    }
};