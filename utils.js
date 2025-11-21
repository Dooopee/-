// utils.js
import { EmbedBuilder } from 'discord.js';
import { client } from './index.js';
import { LOG_CHANNEL_ID } from './config.js'; // или экспортируй константу из index.js

export async function log(title, desc = "", color = "#00ffcc") {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: "Maxim Bot" })
      ]
    });
  } catch (err) {
    console.error("Лог ошибка:", err);
  }
}
