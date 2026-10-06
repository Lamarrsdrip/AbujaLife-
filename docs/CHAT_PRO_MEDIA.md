# AbujaLife Chat Pro media configuration

Photo and voice-note messages are private chat media. Local development stores them under `.local/chat-media` automatically. Production intentionally fails closed unless private S3-compatible storage is configured, so the application server never becomes a permanent large-media origin.

Required production environment variables:

- `CHAT_MEDIA_S3_ENDPOINT` — HTTPS S3-compatible endpoint (Cloudflare R2 works)
- `CHAT_MEDIA_S3_BUCKET` — private bucket name
- `CHAT_MEDIA_S3_ACCESS_KEY_ID` — access key scoped to this bucket
- `CHAT_MEDIA_S3_SECRET_ACCESS_KEY` — corresponding secret
- `CHAT_MEDIA_S3_REGION` — usually `auto` for R2

The bucket must remain private. AbujaLife stores objects below `chat/<media-id>` and returns short-lived authenticated/presigned reads. Do not make the bucket public and do not commit credentials.

Before merging to main, Grok/local QA must verify with two accounts:

1. send and receive a compressed photo;
2. open the photo full screen;
3. record a voice note, cancel one, then record/review/send another;
4. play/pause/seek the received voice note;
5. swipe/reply to text, photo and voice messages;
6. delete a normal message for self and sender-owned message for everyone;
7. verify transfer receipts remain immutable and render as completed Game Naira receipts;
8. reload both sessions and confirm media/replies still resolve;
9. test blocked/muted residents and private media access;
10. confirm production uses S3/R2 mode rather than local disk.
