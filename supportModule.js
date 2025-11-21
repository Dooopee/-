import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { SUPPORT_CATEGORY_ID, LOG_CHANNEL_ID } from './config.js';

const TICKET_PREFIX = 'ticket-';

export function initSupportModule(client, supportChannelId) {

  const sendSupportButton = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const supportChannel = await guild.channels.fetch(supportChannelId).catch(() => null);
      if (!supportChannel || !supportChannel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setTitle('💬 Нужна помощь?')
        .setDescription('Нажми кнопку ниже, чтобы создать тикет и связаться с модератором.')
        .setColor(0x3498db)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Связь с модератором')
          .setStyle(ButtonStyle.Primary)
      );

      await supportChannel.send({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error('Failed to send support button', e);
    }
  };

  sendSupportButton();

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isButton()) return;

      // === КНОПКА СОЗДАНИЯ ТИКЕТА ===
      if (interaction.customId === 'create_ticket') {
        const user = interaction.user;
        const guild = interaction.guild || client.guilds.cache.first();
        if (!guild) return;

        const category = guild.channels.cache.get(SUPPORT_CATEGORY_ID) || null;

        const channel = await guild.channels.create({
          name: `${TICKET_PREFIX}${user.username}`.toLowerCase().slice(0, 90),
          type: 0,
          parent: category ? category.id : undefined,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ]
        });

        const embed = new EmbedBuilder()
          .setTitle('🎫 Тикет открыт')
          .setDescription(`Привет, ${user}. Ожидай ответа модератора.`)
          .setColor(0x9b59b6)
          .setTimestamp();

        const userRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('contact_mod')
            .setLabel('Связь с модератором')
            .setStyle(ButtonStyle.Primary)
        );

        const modRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_resolve')
            .setLabel('Решено')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );

        await channel.send({ 
          content: `<@${user.id}>`, 
          embeds: [embed], 
          components: [userRow, modRow] 
        });

        if (LOG_CHANNEL_ID) {
          const logCh = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
          if (logCh?.isTextBased()) logCh.send({ content: `Новый тикет: ${channel} от ${user.tag}` });
        }

        await interaction.reply({ 
          content: `Тикет создан: ${channel}`, 
          flags: MessageFlags.Ephemeral 
        });
      }

      // === КНОПКА РЕШЕНО ===
      if (interaction.customId === 'ticket_resolve') {
        const isMod = interaction.member.roles.cache.some(r => r.name.toLowerCase().includes('mod')) ||
                      interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

        if (!isMod) {
          return interaction.reply({ 
            content: 'Только модераторы могут закрыть тикет.', 
            flags: MessageFlags.Ephemeral 
          });
        }

        await interaction.deferUpdate();
        await interaction.channel.delete(`Ticket resolved by ${interaction.user.tag}`).catch(() => null);
      }

      // === КНОПКА СВЯЗЬ С МОДЕРАТОРОМ ===
      if (interaction.customId === 'contact_mod') {
        await interaction.reply({ 
          content: 'Модератор уведомлён, скоро свяжется с вами.', 
          flags: MessageFlags.Ephemeral 
        });

        if (LOG_CHANNEL_ID) {
          const logCh = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
          if (logCh?.isTextBased()) logCh.send(`Пользователь ${interaction.user.tag} нажал "Связь с модератором"`);
        }
      }

    } catch (e) {
      console.error('Support module interaction error', e);
    }
  });

}

