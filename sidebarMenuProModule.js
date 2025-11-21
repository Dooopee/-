import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default class SidebarMenuPro {
  constructor(client, guildId) {
    this.client = client;
    this.guildId = guildId;

    // Цвета для градиента и анимации
    this.colors = [0x1a1a1a, 0x6a0dad, 0xffffff, 0x2b2b2b, 0x9933ff];
    this.dividers = ["─────────────", "═════════════", "• • • • • • •"];
    this.emoji = ["💥", "🔥", "⚡", "✨", "🌌"];
  }

  // Формируем Embeds для бокового меню
  async decorateSidebar(channelsInfo) {
    const sidebar = [];
    let colorIndex = 0;

    for (const cat of channelsInfo) {
      const color = this.colors[colorIndex % this.colors.length];
      const emoji = this.emoji[colorIndex % this.emoji.length];

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${cat.name}`)
        .setDescription(cat.description || "—")
        .setColor(color)
        .setFooter({ text: `Maxim Bot | ${new Date().toLocaleDateString()}` });

      sidebar.push(embed);

      // Разделитель
      const divider = this.dividers[colorIndex % this.dividers.length];
      sidebar.push(new EmbedBuilder().setDescription(divider).setColor(color));

      colorIndex++;
    }

    return sidebar;
  }

  // Добавляем кнопки для интерактивности
  createButtons(channelsInfo) {
    const rows = [];
    let currentRow = new ActionRowBuilder();

    channelsInfo.forEach((cat, i) => {
      const button = new ButtonBuilder()
        .setCustomId(`sidebar_${i}`)
        .setLabel(cat.name)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(this.emoji[i % this.emoji.length]);

      currentRow.addComponents(button);

      // Ограничение на 5 кнопок в одном ряду
      if ((i + 1) % 5 === 0 || i === channelsInfo.length - 1) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
    });

    return rows;
  }

  // Отправка меню в канал (только preview)
  async sendSidebarPreview(channelId, channelsInfo) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel) return;

    const sidebarEmbeds = await this.decorateSidebar(channelsInfo);
    const buttons = this.createButtons(channelsInfo);

    for (const embed of sidebarEmbeds) {
      await channel.send({ embeds: [embed] });
    }

    for (const row of buttons) {
      await channel.send({ components: [row] });
    }
  }
}
