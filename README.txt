Improved bot modules bundle
Files:
- index.js
- config.js
- faqModule.js
- newsModule.js
- supportModule.js

Usage:
1) Put these files in your bot project root (replace existing modules if needed).
2) Install dependencies:
   npm install discord.js@14 node-fetch dotenv
3) Set .env with at least:
   TOKEN=your_bot_token
   LOG_CHANNEL_ID=1436699596913901710
   NEWS_CHANNEL_ID=1437400670637654056
   SUPPORT_CATEGORY_ID=category_id_for_tickets (optional)
4) Run with node:
   node index.js

Notes:
- newsModule uses a naive fetch example; for reliable news use proper news APIs or RSS parsing.
- Adjust role checks (Moderator) to match your server.
- The code is ESM-style; ensure package.json has "type": "module" or run with node --input-type=module as appropriate.
