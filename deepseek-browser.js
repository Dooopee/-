require('dotenv').config();
const puppeteer = require('puppeteer');

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
const DEEPSEEK_API = process.env.DEEPSEEK_API || 'https://www.deepseek.com/api/chat';

if (!DEEPSEEK_KEY) {
  throw new Error('DEEPSEEK_KEY не задан в .env');
}

/**
 * Отправляет prompt в DeepSeek через "реальный" браузер (Puppeteer),
 * возвращает текст ответа или бросает ошибку.
 *
 * usage:
 *   const r = await getDeepSeekResponse("Привет, помоги с тикетом...");
 */
async function getDeepSeekResponse(prompt, opts = {}) {
  const headless = opts.headless !== undefined ? opts.headless : true;
  const timeout = opts.timeoutMs || 30000;

  // Запускаем Chromium
  const browser = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  try {
    const page = await browser.newPage();
    // Установим заголовки/UA как у нормального браузера
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');
    await page.setViewport({ width: 1200, height: 800 });

    // Зайдем на главную, чтобы Cloudflare/JS-чеки прошли (если есть)
    await page.goto('https://www.deepseek.com/', { waitUntil: 'networkidle2', timeout });

    // Иногда нужно подождать, если CF показывает challenge — даём чуть больше времени
    await page.waitForTimeout(1200);

    // Выполним fetch в контексте страницы — он пройдет через браузерные куки/контекст
    const payload = { prompt };

    const result = await page.evaluate(async (apiUrl, key, payload) => {
      // Здесь выполняется в браузере — можно использовать fetch с Authorization
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify(payload),
          credentials: 'omit'
        });

        // если ответ не JSON — вернуть текст для отладки
        const text = await res.text();
        // попробуем распарсить JSON
        try { return { status: res.status, body: JSON.parse(text) }; }
        catch (e) { return { status: res.status, bodyText: text }; }
      } catch (err) {
        return { error: String(err) };
      }
    }, DEEPSEEK_API, DEEPSEEK_KEY, payload);

    // Разбираем результат
    if (result?.error) {
      throw new Error('Ошибка запроса в браузере: ' + result.error);
    }

    if (result.status >= 400) {
      // вернём подробный ответ для логов (можно сократить)
      throw new Error(`DeepSeek API returned status ${result.status} — ответ: ${JSON.stringify(result.body || result.bodyText).slice(0, 1000)}`);
    }

    // В зависимости от API структура ответа может быть разной.
    // Попробуем несколько вариантов:
    const body = result.body;
    if (!body) {
      throw new Error('Empty body from DeepSeek: ' + JSON.stringify(result).slice(0, 1000));
    }

    // ---- настроить парсинг под реальную структуру DeepSeek ----
    // Часто: { answer: "text..." } или { choices: [{ message: { content: "..." } }] }
    if (typeof body.answer === 'string') return body.answer;
    if (body?.choices && Array.isArray(body.choices) && body.choices[0]?.message?.content) {
      return body.choices[0].message.content;
    }
    // fallback: stringify body
    return JSON.stringify(body);

  } finally {
    try { await browser.close(); } catch (e) {}
  }
}

module.exports = { getDeepSeekResponse };
