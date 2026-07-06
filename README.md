# Marlboro InField — Scan Pack Code

A proof-of-concept for the **InField** field-agent app that lets an agent photograph a
Marlboro/PMI cigarette pack and automatically extract the printed alphanumeric code
(e.g. `8MC L96 4TW HRV`) that sits directly above the pack's DotCode symbol.

Text extraction is done by **Google Gemini 3.1 Flash Lite** (multimodal OCR), called
server-side so the API key never reaches the client.

> **Scope note:** This reads the *human-readable printed code*, not the dot-matrix
> DotCode symbol itself. See `PRD_Scan_Pack_Code_Marlboro.md` for full product context,
> risks, and non-goals.

## Architecture

```
Browser (index.html)  →  NestJS backend (/pack-scan)  →  Gemini 3.1 Flash Lite
```

- **Frontend** — a single static `index.html` (no build step). A vanilla-JS state
  machine renders each screen: splash → camera capture → processing → success /
  no-code / no-camera / no-network.
- **Backend** — a small NestJS app that serves `index.html` and exposes one endpoint.
  It also serves static assets from the project root.

## Project structure

```
marlboroPOC/
├── index.html                     # Frontend (single-file UI + state machine)
├── PRD_Scan_Pack_Code_Marlboro.md # Product requirements
└── server/                        # NestJS backend
    ├── src/
    │   ├── main.ts                 # Bootstrap, CORS, body limits, static assets
    │   ├── app.module.ts
    │   ├── pack-scan.controller.ts # POST /pack-scan
    │   └── pack-scan.service.ts    # Gemini call + schema-constrained extraction
    ├── .env.example
    └── package.json
```

## Prerequisites

- Node.js 18+ and npm
- A Google Gemini API key
- (Optional) [ngrok](https://ngrok.com) for testing the camera on a phone over HTTPS

## Setup

```bash
cd server
npm install
cp .env.example .env
# then edit .env and set GEMINI_API_KEY
```

`.env` values:

| Variable         | Description                        | Default |
|------------------|------------------------------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (required)   | —       |
| `PORT`           | Port the server listens on         | `3000`  |

## Running

Development (auto-reload):

```bash
cd server
npm run start:dev
```

Production-style:

```bash
cd server
npm run build
npm start
```

Then open **http://localhost:3000**.

## Testing on a phone (camera requires HTTPS)

Browsers only allow camera access over HTTPS or `localhost`. To test on a real device,
tunnel the server with ngrok:

```bash
ngrok http 3000
```

Open the printed `https://…ngrok…` URL on your phone. Because the frontend calls the API
with a relative path, both the page and the `/pack-scan` endpoint work through the tunnel
with no code changes.

## API

### `POST /pack-scan`

**Request**

```json
{ "imageBase64": "<base64-encoded JPEG, without the data: prefix>" }
```

**Response**

```json
{ "found": true, "code": "8MC L96 4TW HRV", "confidence": "high" }
```

- `found` — whether a legible code was detected
- `code` — the extracted string (empty when not found)
- `confidence` — `"high" | "medium" | "low"`

The client treats `found: false` or `confidence: "low"` as "no readable code" and prompts
a retry rather than showing a possibly-wrong value.

## Notes

- The JSON body limit is raised to 25 MB in `main.ts` because camera photos are sent as
  base64 and easily exceed Express's 100 KB default.
- Captured images are only used for the extraction request and are not persisted.
