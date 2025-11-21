import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import { NEWS_CHANNEL_ID } from './config.js';

/**
 * News Module
 * - Polls news sources (RSS / API) and posts stylized embeds to the news channel.
 * - Includes ad embed for cs2case.win with promo code.
 *
 * NOTE: For production use get an API key from a news provider or feed list.
 */

const POLL_INTERVAL_MS = 1000 * 60 * 60 * 6; // every 6 hours by default
const PROMO = {
  title: '🎁 CS2CASE — кейсы по CS2',
  description: 'Используй промокод **Dooopee** и получи -30% на сайте https://cs2case.win/',
  url: 'https://cs2case.win/'
};

// naive seen set to avoid reposting same links during runtime
const seen = new Set();

export function initNewsModule(client) {
  async function fetchAndPost() {
    try {
      const channel = await client.channels.fetch(NEWS_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) return;

      // Example: fetch top news from a public JSON endpoint (placeholder)
      // Replace with real endpoints and API keys.
      const res = await fetch('https://api.allorigins.win/raw?url=https://www.hltv.org/news'); // proxy for example
      const text = await res.text();

      // Very simple link extraction (best to replace with proper HTML parsing)
      const links = (text.match(/https?:\/\/[^"'>\s]+/g) || []).slice(0,5);

      for (const link of links) {
        if (seen.has(link)) continue;
        seen.add(link);

        const embed = new EmbedBuilder()
          .setTitle('📰 Новость CS')
          .setDescription(`[Источник](${link}) — Короткое описание.`)
          .setURL(link)
          .setColor(0x2ecc71)
          .setTimestamp();

        const ad = new EmbedBuilder()
          .setTitle(PROMO.title)
          .setDescription(PROMO.description)
          .setURL(PROMO.url)
          .setColor(0xf1c40f);

        await channel.send({ embeds: [embed, ad] });
      }

    } catch (e) {
      console.error('News module error', e);
    }
  }

  // initial fetch on startup
  fetchAndPost();
  setInterval(fetchAndPost, POLL_INTERVAL_MS);
}
