const BASE = '/api/v1';

export function getToken(): string {
  try {
    const raw = localStorage.getItem('duav2_token');
    if (raw) return raw;
  } catch {}
  return '';
}

export function setToken(token: string) {
  localStorage.setItem('duav2_token', token);
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Duas
  getDuas: (params?: Record<string, string>) => request<any>('GET', '/duas' + toQuery(params)),
  getDua: (id: number) => request<any>('GET', '/duas/' + id),
  createDua: (data: any) => request<any>('POST', '/duas', data),
  updateDua: (id: number, data: any) => request<any>('PATCH', '/duas/' + id, data),
  deleteDua: (id: number) => request<any>('DELETE', '/duas/' + id),

  // Videos
  getVideos: (params?: Record<string, string>) => request<any>('GET', '/videos' + toQuery(params)),
  getVideo: (id: number) => request<any>('GET', '/videos/' + id),
  createVideo: (data: any) => request<any>('POST', '/videos', data),
  updateVideo: (id: number, data: any) => request<any>('PATCH', '/videos/' + id, data),
  renderVideo: (id: number) => request<any>('POST', '/videos/' + id + '/render'),

  // Thumbnails
  getThumbs: (videoId: number) => request<any>('GET', '/videos/' + videoId + '/thumbs'),
  setThumb: (videoId: number, variant: string, thumb_path: string) => request<any>('POST', '/videos/' + videoId + '/thumbs', { variant, thumb_path }),
  deleteThumb: (videoId: number, variant: string) => request<any>('DELETE', '/videos/' + videoId + '/thumbs/' + variant),
  swapThumbs: (videoId: number) => request<any>('POST', '/videos/' + videoId + '/thumbs/swap'),

  // Captions
  getCaptions: (videoId: number) => request<any>('GET', '/videos/' + videoId + '/captions'),
  updateCaptions: (videoId: number, caption_en: string) => request<any>('PUT', '/videos/' + videoId + '/captions', { caption_en }),
  importCaptionsSrt: (videoId: number, srt_path: string) => request<any>('POST', '/videos/' + videoId + '/captions/from-srt', { srt_path }),
  previewCaptions: (videoId: number) => request<any>('POST', '/videos/' + videoId + '/captions/preview'),

  // SEO
  getSeo: (videoId: number) => request<any>('GET', '/videos/' + videoId + '/seo'),
  updateSeo: (videoId: number, data: any) => request<any>('PATCH', '/videos/' + videoId + '/seo', data),
  getSeoPillars: () => request<any>('GET', '/seo/pillars'),
  getSeoDistribution: () => request<any>('GET', '/seo/pillars/distribution'),
  suggestSeo: (dua_id: number) => request<any>('POST', '/seo/suggest', { dua_id }),

  // Review / Approval
  getReview: (videoId: number) => request<any>('GET', '/videos/' + videoId + '/review'),
  submitReview: (videoId: number, data: any) => request<any>('POST', '/videos/' + videoId + '/review', data),
  approveVideo: (videoId: number) => request<any>('POST', '/videos/' + videoId + '/approve'),
  rejectVideo: (videoId: number, reason?: string) => request<any>('POST', '/videos/' + videoId + '/reject', { reason }),
  getReviewQueue: () => request<any>('GET', '/review/queue'),

  // Jobs
  getJobs: (params?: Record<string, string>) => request<any>('GET', '/jobs' + toQuery(params)),
  cancelJob: (id: number) => request<any>('POST', '/jobs/' + id + '/cancel'),

  // Status
  getStatus: () => request<any>('GET', '/status'),

  // Monitoring
  getMonitoring: () => request<any>('GET', '/monitoring'),

  // Scheduler
  getSchedules: (status?: string) => request<any>('GET', '/schedules' + (status ? '?status=' + status : '')),
  getCalendar: (month?: string) => request<any>('GET', '/schedules/calendar' + (month ? '?month=' + month : '')),
  createSchedule: (data: any) => request<any>('POST', '/schedules', data),
  updateSchedule: (id: number, data: any) => request<any>('PATCH', '/schedules/' + id, data),
  deleteSchedule: (id: number) => request<any>('DELETE', '/schedules/' + id),
  runPublishCheck: () => request<any>('POST', '/schedules/run-check'),
  getCapacity: () => request<any>('GET', '/schedules/capacity'),

  // Analytics
  getAnalyticsOverview: () => request<any>('GET', '/analytics/overview'),
  getUnderperformers: () => request<any>('GET', '/analytics/underperformers'),
  importAnalytics: (path?: string) => request<any>('POST', '/analytics/import', { path }),

  // Playlists
  getPlaylists: () => request<any>('GET', '/playlists'),
  getPlaylist: (id: number) => request<any>('GET', '/playlists/' + id),
  syncPlaylists: (path?: string) => request<any>('POST', '/playlists/sync', { path }),
  setMemberStatus: (id: number, status: string) => request<any>('PATCH', '/playlists/members/' + id, { status }),
  getPlaylistManifest: (id: number) => request<any>('GET', '/playlists/' + id + '/manifest'),

  // Topics
  getTopics: (status?: string) => request<any>('GET', '/topics' + (status ? '?status=' + status : '')),
  addTopic: (keyword: string, source?: string) => request<any>('POST', '/topics', { keyword, source }),
  suggestTopics: (limit?: number) => request<any>('POST', '/topics/suggest', { limit }),
  updateTopic: (id: number, status: string) => request<any>('PATCH', '/topics/' + id, { status }),
  deleteTopic: (id: number) => request<any>('DELETE', '/topics/' + id),

  // Share kit
  getShareKit: (yid: string) => request<any>('GET', '/share/' + yid),
};

function toQuery(params?: Record<string, string>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? '?' + entries.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&') : '';
}
