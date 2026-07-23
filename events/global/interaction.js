const fs = require("fs");
const path = require("path");
const componentBuilder = require("../../classes/Component");
const { guildID } = require("../../data/config.json");
const { logCommand, logError } = require("../../functions/Logger");
const { User } = require("../../functions/Database");

const inCooldown = new Map()

function getBlacklistData() {
    try {
        const data = fs.readFileSync(path.join(__dirname, "../../data/whitelist.json"), "utf8");
        return JSON.parse(data);
    } catch {
        return { authorizedUsers: [], blacklistedUsers: [] };
    }
}

module.exports = {
    name: "interactionCreate",
    async execute(interaction) {
        if (interaction.isButton()) {
            if (interaction.customId === "stop_operation") {
                const crashFile = require("../../commands/connection/crash.js");
                const chatFile = require("../../commands/connection/chat.js");

                let stopped = false;

                if (crashFile.currentlyCrashing?.has(interaction.user.id)) {
                    crashFile.currentlyCrashing.delete(interaction.user.id);
                    stopped = true;
                }

                if (chatFile.currentlyChatting?.has(interaction.user.id)) {
                    chatFile.currentlyChatting.delete(interaction.user.id);
                    stopped = true;
                }

                if (stopped) {
                    await interaction.reply({ content: "-# Operation stopped.", flags: 64 });
                } else {
                    await interaction.reply({ content: "-# No active operation found.", flags: 64 });
                }
            }
            return;
        }

        if (!interaction.isCommand()) return;

        let command =
            interaction.client.commands.get(interaction.commandName) ||
            interaction.client.commands.get(interaction.options.getSubcommand(false));

        if (!command) return;
        if (typeof User.findOne !== "function") return;

        const blacklistData = getBlacklistData();
        if (blacklistData.blacklistedUsers?.includes(interaction.user.id)) {
            return interaction.reply({ content: "-# You are blacklisted from using this bot.", flags: 64 });
        }

        console.log(`[interaction] executed ${command.data.name} for ${interaction.user.tag} (${interaction.user.id}) ${interaction.guild ? `in ${interaction.guild.name}` : 'in DMs'}`);

        logCommand(interaction, interaction.client).catch(() => {});

        const cooldown = inCooldown.get(interaction.user.id);
        if (cooldown && Date.now() < cooldown) {
            return interaction.reply({ content: `-# *Your on a cooldown from your previous command, cooldown reset <t:${Math.floor(cooldown / 1000)}:R>*`, flags: 64 });
        }

        inCooldown.set(interaction.user.id, (command?.cooldown ?? 5000) + Date.now());

        const component = new componentBuilder();
        let dbUser;

        try {
            dbUser = (await User.findOne({ id: interaction.user.id })) || new User({ id: interaction.user.id });
            await dbUser.save();
        } catch (err) {
            console.error('DB lookup failed:', err.message);
            return interaction.reply({ content: "-# Database error. Try again later.", flags: 64 });
        }

        for (const check of [
            {
                message: "### -# **This command is a end guild only command, please don't try to use it anywhere else!**",
                condition: () => command.guildOnly && (!interaction.guild || interaction.guild.id !== guildID)
            },
            {
                message: "### -# **This command is a staff only command, please don't try to use it!**",
                condition: () => command.staffOnly && !dbUser.staff
            },
            {
                message: "### -# **This command requires you to be linked, please use `/account link` to link your account!**",
                condition: () => command.linkOnly && !dbUser.linked
            }
        ]) {
            if (check.condition()) return interaction.reply({ content: check.message, flags: 64 });
        }

        try {
            await command.execute(interaction, { component, flags: [1 << 15], dbUser });
            console.log(`[interaction] command finished for ${interaction.user.username} in ${Date.now() - interaction.createdTimestamp}ms`);
        } catch (error) {
            console.error(error);
            logError(command?.data?.name || command?.subCommand || 'unknown', error, interaction.client, { user: interaction.user }).catch(() => {});

            if (interaction.deferred) {
                await interaction.followUp({ content: "There was an error executing this command!", flags: [64] });
            } else if (!interaction.replied) {
                await interaction.reply({ content: "There was an error executing this command!", flags: [64] });
            }
        }
    }
};
