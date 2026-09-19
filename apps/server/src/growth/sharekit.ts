export interface SharePayload {
  video_yid: string;
  watch_url: string;
  dua_title: string;
  dua_reference: string;
  dua_text: string;
  share_text: string;
  hashtags: string[];
}

export function buildSharePayload(video: any, dua: any): SharePayload {
  const yid = video?.video_id || '';
  const title = dua?.title || dua?.title_en || 'Dua';
  const reference = dua?.reference || '';
  const duaText = dua?.arabic || duasnippet(dua);
  const hashtags = ['#Dua', '#IslamicReminders', '#Quran', '#Sunnah'];
  const watchUrl = yid ? 'https://www.youtube.com/watch?v=' + yid : '';
  const post = [
    '🤲 ' + title,
    '',
    duaText,
    reference ? ('📖 ' + reference) : '',
    '',
    'Watch the full video 👇',
    watchUrl,
    hashtags.join(' '),
  ].filter(Boolean).join('\n');

  return {
    video_yid: yid,
    watch_url: watchUrl,
    dua_title: title,
    dua_reference: reference,
    dua_text: duaText,
    share_text: post,
    hashtags,
  };
}

function duasnippet(dua: any): string {
  const parts = [dua?.english, dua?.urdu, dua?.explanation].filter(Boolean);
  const full = parts.join(' ');
  return full.length > 280 ? full.slice(0, 277) + '…' : full;
}