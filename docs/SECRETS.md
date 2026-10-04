# Secrets and settings

Names only. Real values live in the two `.env` files, which are git-ignored and never committed,
pasted in chat, logged or sent to the frontend (CLAUDE.md section 12).

## backend/.env

| Name | Required | What it is |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | yes, for AI | IAM user limited to `bedrock:InvokeModel` and `polly:SynthesizeSpeech`. |
| `AWS_SECRET_ACCESS_KEY` | yes, for AI | The secret for that IAM user. |
| `AWS_REGION` | no | Defaults to `us-east-1`. |
| `BEDROCK_MODEL_ID` | no | The Bedrock model for chat, summary and documents. Defaults to Claude Haiku 4.5. |
| `ELEVENLABS_API_KEY` | no | ElevenLabs text-to-speech key (starts with `sk_`). Without it, `/speak` uses Polly. |
| `ELEVENLABS_VOICE_ID` | no | The ElevenLabs voice to use. Without it, `/speak` uses Polly. |
| `ELEVENLABS_MODEL_ID` | no | Defaults to `eleven_flash_v2_5` (fast, speaks English, Spanish, French and Portuguese). |

Without the AWS keys, every AI route falls back to its fixed text in `sockets.py` and the app still works.
Without any voice, the text stays on screen.

## frontend/.env

| Name | Required | What it is |
|---|---|---|
| `VITE_API_URL` | yes | The backend URL, for example `http://localhost:8000`. Not a secret: it ends up in the browser. |
