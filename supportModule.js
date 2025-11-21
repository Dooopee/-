import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  Colors
} from 'discord.js';
import { SUPPORT_CATEGORY_ID, LOG_CHANNEL_ID, MOD_ROLE_ID } from './config.js'; // добавь MOD_ROLE_ID в config!

const TICKET_PREFIX = 'ticket-';

export function initSupportModule(client, supportChannelId) {
  // Отправляем сообщение с кнопкой создания тикета (один раз)
  const sendSupportButton = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const channel = await guild.channels.fetch(supportChannelId).catch(() => null);
      if (!channel?.isTextBased()) return;

      // Проверяем, не отправлено ли уже
      const messages = await channel.messages.fetch({ limit: 10 });
      if (messages.some(m => m.author.id === client.user.id && m.embeds[0]?.title === 'Нужна помощь?')) {
        return; // уже есть
      }

      const embed = new EmbedBuilder()
        .setTitle('Нужна помощь?')
        .setDescription('Нажми кнопку ниже, чтобы создать тикет и связаться с модератором.')
        .setColor(0x3498db)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Связь с модератором')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      await channel.send({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error('Failed to send support button:', e);
    }
  };

  // Запускаем при старте бота
  client.once('ready', () => {
    console.log('Support module загружен');
    sendSupportButton();
  });

  // Главный обработчик всех кнопок
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    try {
      // 1. Создание тикета
      if (interaction.customId === 'create_ticket') {
        if (!interaction.guild) return;

        const user = interaction.user;

        // Проверка на уже существующий тикет
        const existingChannel = interaction.guild.channels.cache.find(ch =>
          ch.name === `${TICKET_PREFIX}${user.username.toLowerCase()}`
        );
        if (existingChannel) {
          return interaction.reply({
            content: `У тебя уже есть тикет: ${existingChannel}`,
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });

        const channel = await interaction.guild.channels.create({
          name: `${TICKET_PREFIX}${user.username.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: SUPPORT_CATEGORY_ID || null,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: MOD_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] } // важно!
          ]
        });

        const welcomeEmbed = new EmbedBuilder()
          .setTitle('Тикет открыт')
          .setDescription(`Привет, ${user}! Скоро с тобой свяжется модератор.\nОпиши свою проблему подробно.`)
          .setColor(Colors.Blurple)
          .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Закрыть тикет')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId('ticket_alert')
            .setLabel('Позвать модератора')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔔')
        );

        const msg = await channel.send({
          content: `${user} | <@&${MOD_ROLE_ID}>`,
          embeds: [welcomeEmbed],
          components: [buttons]
        });

        await msg.pin();

        // Лог
        if (LOG_CHANNEL_ID) {
          const log = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
          if (log?.isTextBased()) {
            log.send(`Новый тикет: ${channel} | От: ${user.tag} (${user.id})`);
          }
        }

        await interaction.editReply({
          content: `Тикет создан: ${channel}`,
          ephemeral: true
        });
      }

      // 2. Кнопка "Позвать модератора"
      if (interaction.customId === 'ticket_alert') {
        if (!interaction.channel?.name.startsWith(TICKET_PREFIX)) return;

        await interaction.reply({
          content: 'Модераторы уведомлены! Ожидай ответа.',
          ephemeral: true
        });

        await interaction.channel.send({
          content: `<@&${MOD_ROLE_ID}> Пользователь просит внимания!`
        });
      }

      // 3. Закрытие тикета
      if (interaction.customId === 'ticket_close') {
        if (!interaction.channel?.name.startsWith(TICKET_PREFIX)) return;

        const member = interaction.member;
        const hasPerms = member.roles.cache.has(MOD_ROLE_ID) ||
                        member.permissions.has(PermissionFlagsBits.ManageChannels);

        if (!hasPerms) {
          return interaction.reply({ content: 'Только модераторы могут закрывать тикеты.', ephemeral: true });
        }

        await interaction.reply(`Тикет будет удалён через 5 секунд...`);
        setTimeout(() => {
          interaction.channel.delete(`Закрыт модератором ${interaction.user.tag}`).catch(() => {});
        }, 5000);
      }

    } catch (error) {
      console.error('Ошибка в support module:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Произошла ошибка.', ephemeral: true }).catch(() => {});
      }
    }
  });
}
