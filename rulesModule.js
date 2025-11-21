import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { log } from './utils.js'; // <- исправлено

export default function initRulesModule(client, options) {
  const { guildId, channelId, ackRoleId, supportChannelId } = options;

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.inGuild()) return;
    if (interaction.guild.id !== guildId) return;

    try {
      // --- Кнопка подтверждения правил ---
      if (interaction.isButton() && interaction.customId === 'ack_rules') {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(ackRoleId);
        if (!role) return interaction.editReply({ content: "Роль не найдена!" });

        if (!member.roles.cache.has(role.id)) {
          await member.roles.add(role).catch(() => {});
          await interaction.editReply({ content: "Роль успешно выдана!" });
        } else {
          await interaction.editReply({ content: "Роль уже есть." });
        }
      }

      // --- Кнопка тикета поддержки ---
      if (interaction.isButton() && interaction.customId === 'support_ticket') {
        await interaction.deferReply({ ephemeral: true });

        const modal = new ModalBuilder()
          .setCustomId('modal_support_ticket')
          .setTitle('Запрос поддержки');

        const input = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Опиши проблему')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Что случилось?')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
      }

      // --- Обработка модали ---
      if (interaction.isModalSubmit() && interaction.customId === 'modal_support_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const desc = interaction.fields.getTextInputValue('description');

        const channel = await client.channels.fetch(supportChannelId).catch(() => null);
        if (!channel) return interaction.editReply({ content: "Канал поддержки не найден!" });

        const embed = new EmbedBuilder()
          .setTitle("Новая заявка поддержки")
          .setDescription(desc)
          .addFields({ name: "Отправил", value: `${interaction.user.tag} (<@${interaction.user.id}>)` })
          .setColor("#00ccff");

        await channel.send({ embeds: [embed] });
        await interaction.editReply({ content: "Заявка отправлена!" });
      }

    } catch (err) {
      await log("Rules module interaction error", err.message, "#ff0000");
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "Ошибка!", ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: "Ошибка!", ephemeral: true }).catch(() => {});
      }
    }
  });
}
