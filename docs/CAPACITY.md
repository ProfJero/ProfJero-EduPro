# Capacity on free tiers (≈600 students today)

**Short answer: yes — 600 students fit comfortably on the free tiers**, with room to grow to a few thousand, as long as the points under “Watch” are respected. The owner console’s **System monitor** (run on demand) shows the real numbers against each limit.

| Service / limit (free) | What ProfJero Edu uses for ~600 students | Headroom |
|---|---|---|
| Supabase database 500 MB | Curriculum + seed ≈ 5 MB; per active student ≈ 50–150 KB per term (progress, attempts, messages, notifications) → ≈ 30–90 MB | ~5× |
| Supabase monthly active users 50,000 | 600 | ~80× |
| Supabase egress 5 GB / month | JSON only (media is on Cloudinary/YouTube); ≈ 2–4 MB per active student per month → 1.2–2.4 GB | ~2× |
| Supabase Realtime: 200 concurrent connections, 2 M messages / month | One connection per open app tab (all channels share it). Usually < 100 at once | OK for normal days |
| Cloudflare Workers/Pages Functions 100,000 requests / day | Static files skip the worker (`_routes.json`) and are cached by the service worker; ≈ 20–40 API/page requests per active student per day → 12–24 k | ~4× |
| Cloudinary free credits | Images/videos you upload; transformations use `q_auto`/low-data variants | Watch the Cloudinary dashboard |
| Gemini API | Each AI request is metered per user per day (plan feature `ai_requests_per_day`); the AI switch in System controls turns it off instantly | Set limits that match your key’s quota |

## Watch
- **More than ~200 students online at the same moment** (e.g. a whole school in one live lesson): extra connections can’t join live presence. The app keeps working (presence shows “offline”, discussion still loads); students on **low-data mode** don’t open realtime connections at all.
- **Inactivity pause:** free Supabase projects pause after a week without use. Daily school use prevents this.
- **Housekeeping:** press *Housekeeping* in the System monitor monthly — it removes old read notifications, stale game attempts and old HTTP logs.

## Built-in savings
Lessons and the app shell are cached offline by the service worker; notifications use push instead of polling; dashboards and the monitor query only when opened; low-data mode turns off web fonts, auto-loading media and realtime.

## When to upgrade
Upgrade Supabase to Pro (paid) when the System monitor shows the database above ~70% of 500 MB, or regularly > 150 simultaneous users. Nothing in the code changes.
