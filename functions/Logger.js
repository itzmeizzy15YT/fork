"use strict";

const { EmbedBuilder } = require("discord.js");
const { errorLogChannel, commandLogChannel } = require("../data/config.json");

async function logCommand(interaction, client) {
    if (!commandLogChannel) return;

    try {
        const channel = await client.channels.fetch(commandLogChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle("Command Used")
            .setColor(0x6C8CFF)
            .addFields(
                { name: "User", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: true },
                { name: "Command", value: `\`/${interaction.commandName}\``, inline: true },
                { name: "Location", value: interaction.guild ? `${interaction.guild.name}` : "DMs", inline: true }
            )
            .setTimestamp();

        if (interaction.options?.data?.length) {
            const options = interaction.options.data.map(o => `\`${o.name}\`: ${o.value ?? 'none'}`).join('\n');
            embed.addFields({ name: "Options", value: options.slice(0, 1024) });
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error("Failed to log command:", err.message);
    }
}

async function logError(source, error, client, extra = {}) {
    if (!errorLogChannel) return;

    try {
        const channel = await client.channels.fetch(errorLogChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle("Error")
            .setColor(0xF87171)
            .addFields(
                { name: "Source", value: `\`${source}\``, inline: true },
                { name: "Error", value: `\`\`\`${error.message?.slice(0, 500) || String(error).slice(0, 500)}\`\`\`` }
            )
            .setTimestamp();

        if (extra.user) {
            embed.addFields({ name: "User", value: `${extra.user.tag || extra.user} (\`${extra.user.id || ''}\`)` });
        }

        if (error.stack) {
            embed.addFields({ name: "Stack", value: `\`\`\`${error.stack.slice(0, 1000)}\`\`\`` });
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error("Failed to log error:", err.message);
    }
}

module.exports = { logCommand, logError };
