// ورکر اختصاصی «رادیوجوان دانلودر» — پشتیبانی از شوهای پادکست، هنرمندان، جستجو و ارسال مستقیم به تلگرام[cite: 2]
const RJ_API = 'https://rj-deskcloud.com/api2/';
const RJ_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US',
  'x-rj-user-agent': 'Radio Javan/5.0.0 (Desktop) com.radioJavan.rj.desktop',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) RadioJavan/5.2.0 Chrome/130.0.6723.118 Electron/33.2.0 Safari/537.36',
};

const ENDPOINT_BY_KIND = {
  song: 'mp3',
  podcast: 'podcast',
  podcast_show: 'podcast_show',
  playlist: 'mp3_playlist_with_items',
  artist: 'artist',
  search: 'search',
};

// توکن ربات تلگرام خود را اینجا قرار دهید یا در متغیرهای ورکر (Variables) تنظیم کنید
const DEFAULT_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';

export default {
  async fetch(request, env) {
    const BOT_TOKEN = env?.BOT_TOKEN || DEFAULT_BOT_TOKEN;
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const kind = url.searchParams.get('kind') || url.searchParams.get('action');

    try {
      // ارسال مستقیم موزیک/پادکست به چت کاربر در تلگرام
      if (kind === 'send_tg') {
        const chatId = url.searchParams.get('chat_id');
        const audioUrl = url.searchParams.get('audio_url');
        const title = url.searchParams.get('title') || 'Music';
        const performer = url.searchParams.get('artist') || 'Radio Javan';
        const coverUrl = url.searchParams.get('cover');

        if (!chatId || !audioUrl) {
          return new Response(JSON.stringify({ ok: false, error: 'Missing chat_id or audio_url' }), {
            status: 400,
            headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
          });
        }

        const tgPayload = {
          chat_id: chatId,
          audio: audioUrl,
          title: title,
          performer: performer,
          caption: `🎵 <b>${title}</b>\n👤 <b>${performer}</b>\n\n🤖 @RjDownloaderBot`,
          parse_mode: 'HTML',
        };
        if (coverUrl) tgPayload.thumbnail = coverUrl;

        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tgPayload),
        });

        const tgData = await tgRes.text();
        return new Response(tgData, {
          status: tgRes.status,
          headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
        });
      }

      if (kind === 'resolve') {
        const shortUrl = url.searchParams.get('url');
        if (!shortUrl) return new Response('Missing url', { status: 400, headers: CORS });
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10000);
        let res;
        try {
          res = await fetch(shortUrl, {
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: ctrl.signal,
          });
        } finally { clearTimeout(t); }
        return new Response(JSON.stringify({ url: res.url }), {
          status: 200,
          headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
        });
      }

      if (kind in ENDPOINT_BY_KIND) {
        const id = url.searchParams.get('id') || url.searchParams.get('query');
        if (!id) return new Response('Missing id/query', { status: 400, headers: CORS });

        const endpoint = ENDPOINT_BY_KIND[kind];
        const paramName = (kind === 'artist' || kind === 'search') ? 'query' : 'id';
        const rjUrl = `${RJ_API}${endpoint}?${paramName}=${encodeURIComponent(id)}`;

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        let rjRes;
        try {
          rjRes = await fetch(rjUrl, { headers: RJ_HEADERS, signal: ctrl.signal, cf: { cacheTtl: 0, cacheEverything: false } });
        } finally { clearTimeout(t); }
        const body = await rjRes.text();
        return new Response(body, {
          status: rjRes.status,
          headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
        });
      }

      if (kind === 'file') {
        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) return new Response("Missing 'url' parameter", { status: 400, headers: CORS });

        let parsedTarget;
        try {
          parsedTarget = new URL(targetUrl);
          if (!/^https?:$/.test(parsedTarget.protocol)) throw new Error('bad protocol');
        } catch (e) {
          return new Response("Invalid 'url' parameter", { status: 400, headers: CORS });
        }

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 45000);
        let fileRes;
        try {
          fileRes = await fetch(parsedTarget.href, {
            headers: {
              'User-Agent': RJ_HEADERS['User-Agent'],
              'Referer': 'https://play.radiojavan.com/',
            },
            redirect: 'follow',
            signal: ctrl.signal,
            cf: { cacheTtl: 0, cacheEverything: false },
          });
        } finally { clearTimeout(t); }

        const newHeaders = new Headers(fileRes.headers);
        ['content-encoding', 'content-length', 'transfer-encoding'].forEach((h) => newHeaders.delete(h));
        Object.entries(CORS).forEach(([k, v]) => newHeaders.set(k, v));

        return new Response(fileRes.body, {
          status: fileRes.status,
          statusText: fileRes.statusText,
          headers: newHeaders,
        });
      }

      return new Response('Unknown kind', { status: 400, headers: CORS });
    } catch (err) {
      return new Response(err.message, { status: 502, headers: CORS });
    }
  },
};
