import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';
import { log } from './utils.js';

export function initFaqModule(client, options) {
  const { channelId, guildId, rulesChannelId, supportChannelId, ticketCategoryId, modRoleId } = options;

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.inGuild() || interaction.guild.id !== guildId) return;

    try {
      if (interaction.isButton() && interaction.customId === 'faq_ticket') {
        await interaction.deferReply({ ephemeral: true });

        const modal = new ModalBuilder()
          .setCustomId('modal_faq_ticket')
          .setTitle('Связь с модератором');

        const input = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Опиши проблему')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Что случилось?')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
      }

      if (interaction.isModalSubmit() && interaction.customId === 'modal_faq_ticket') {
        const desc = interaction.fields.getTextInputValue('description');
        const supportChannel = await client.channels.fetch(supportChannelId).catch(() => null);
        if (!supportChannel) return interaction.reply({ content: "Канал поддержки не найден!", ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle("Новая заявка через FAQ")
          .setDescription(desc)
          .addFields({ name: "Отправил", value: `${interaction.user.tag} (<@${interaction.user.id}>)` })
          .setColor("#00ccff");

        await supportChannel.send({ embeds: [embed] });
        await interaction.reply({ content: "Заявка отправлена!", ephemeral: true });
      }
    } catch (err) {
      await log("FAQ module interaction error", err.message, "#ff0000");
      if (!interaction.replied && !interaction.deferred) {
        interaction.reply({ content: "Ошибка!", ephemeral: true }).catch(() => {});
      }
    }
  });
}
