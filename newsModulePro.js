import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { log } from './index.js';

export default function initNewsModule(client, options) {
  const { channelId } = options;

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.inGuild()) return;

    try {
      // --- Проверяем, что это кнопка ---
      if (interaction.isButton()) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.customId === "news_update") {
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (!channel) return interaction.editReply({ content: "Канал не найден." });

          const embed = new EmbedBuilder()
            .setTitle("Новости")
            .setDescription("Новость устарела.")
            .setColor("#ffcc00");

          await channel.send({ embeds: [embed] });
          await interaction.editReply({ content: "Новость обновлена!" });
          return;
        }

        await interaction.editReply({ content: "Неизвестная кнопка." });
      }

    } catch (err) {
      await log("FAQ module interaction error", err.message, "#ff0000");
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "Ошибка!", ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: "Ошибка!", ephemeral: true }).catch(() => {});
      }
    }
  });
}
