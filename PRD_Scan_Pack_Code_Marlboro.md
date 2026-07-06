# PRD: Scan Pack Code (Marlboro)

**Product:** InField
**Screen:** `test_marlboro`
**Client:** Marlboro (Philip Morris International)
**Author:** Santosh Kumar, Head of Engineering, FirstMeridian
**Status:** Draft
**Last updated:** July 6, 2026

---

## 1. Background

Marlboro/PMI cigarette packs carry a printed alphanumeric code (e.g. `8MC L96 4TW HRV`) directly above a DotCode — a dot-matrix anti-counterfeiting/track-and-trace symbol. The alphanumeric string is the human-readable representation of the same batch/pack identifier.

This PRD covers reading that **printed alphanumeric code** via the device camera, using Gemini 3.1 Flash Lite for text extraction (OCR), and surfacing the decoded value in the InField app.

**Important scope clarification:** this feature reads the human-readable printed code, not the DotCode dot-matrix symbol itself. Gemini and other general vision LLMs are not reliable decoders for dot-matrix barcode symbologies — that requires a dedicated barcode SDK (e.g. Dynamsoft, Scandit) with true DotCode support. If a future requirement needs the raw DotCode payload decoded (for serial-level verification against PMI's track-and-trace system), that is a separate, larger effort and should be scoped independently. See Section 9 (Risks).

---

## 2. Problem Statement

Field agents currently have no way to quickly capture and log the pack identifier code during Marlboro consumer survey/verification visits. Manual transcription is slow and error-prone. We need a camera-based capture flow that extracts the code automatically and displays it for confirmation.

---

## 3. Goals

- Let a field agent scan a pack and get the printed code back in under a few seconds.
- Reduce manual transcription errors.
- Fail safely and visibly when the code can't be read, rather than returning a wrong value.

### Non-goals (this iteration)

- Decoding the DotCode dot-matrix symbol itself.
- Verifying the code against PMI's track-and-trace/serialization database.
- Offline scanning (requires network call to backend/Gemini).
- Batch scanning of multiple packs in one session.

---

## 4. Users

Field agents using the InField app during Marlboro consumer survey visits, entering pack data as part of the existing survey journey (`test_marlboro`).

---

## 5. User Flow

1. Agent reaches the "Scan Pack Code" step within the `test_marlboro` journey.
2. Taps **Scan Pack Code**.
3. Device camera opens with a guided capture frame overlay (aligned to where the code sits on the pack).
4. Agent aligns the pack and captures (auto-capture on focus lock, or manual shutter — see open question in Section 10).
5. App shows a brief loading state while the image is sent for extraction.
6. On success: extracted code is displayed below the scanner, with an option to **Retry** if it looks wrong.
7. On failure: an inline error message is shown with a **Retry** action; no code is auto-filled.
8. Once accepted, the value is stored against the survey record like any other field.

---

## 6. Functional Requirements

| # | Requirement |
|---|---|
| FR1 | Tapping "Scan Pack Code" requests camera permission (if not already granted) and opens the live camera view. |
| FR2 | The UI shows a capture guide/frame indicating where to position the pack's printed code line. |
| FR3 | Captured image is sent to the backend, which calls Gemini 3.1 Flash Lite with a schema-constrained extraction prompt. |
| FR4 | The backend returns a structured result: `{ found: boolean, code: string, confidence: 'high' | 'medium' | 'low' }`. |
| FR5 | If `found` is false or `confidence` is `low`, the app shows an error state and does not populate a value. |
| FR6 | On success, the extracted code is shown as editable text below the scanner so the agent can correct OCR mistakes before saving. |
| FR7 | Agent can retake the photo without leaving the screen. |
| FR8 | Camera permission denial shows a clear message with a link to app settings, distinct from the "code not readable" error. |
| FR9 | The captured image is not persisted beyond the extraction request unless product/compliance requires an audit trail (open question, Section 10). |

---

## 7. Technical Design

### 7.1 Architecture

```
InField (Flutter)  →  NestJS backend endpoint  →  Gemini 3.1 Flash Lite (multimodal)
```

The Gemini API key stays server-side. The client never calls Gemini directly.

### 7.2 Client (Flutter)

- Camera capture via the `camera` package (or `mobile_scanner` if we want a live-frame pipeline instead of single-shot capture).
- Basic client-side checks before upload: reject frames that are clearly out of focus or too dark, to avoid wasted round-trips.
- States: `idle → capturing → uploading → success | error`.

### 7.3 Backend endpoint

`POST /pack-scan`

Request: `{ imageBase64: string }`

Calls Gemini 3.1 Flash Lite (`gemini-3.1-flash-lite`) with:
- The captured image.
- A prompt instructing the model to extract only the printed alphanumeric line directly above the dot-matrix pattern, and to return `found: false` rather than guess if the text isn't clearly legible.
- `responseSchema` constraining output to `{ found, code, confidence }` for reliable parsing.

Response mirrors that schema back to the client. A `confidence: low` or `found: false` result is treated as a 4xx-equivalent "no code detected" case, not a 500.

### 7.4 Error handling

| Condition | Client behavior |
|---|---|
| Camera permission denied | Prompt to open app settings |
| Network/backend failure | "Couldn't reach the server, try again" + retry |
| `found: false` | "No valid code detected, try again" + retry |
| `confidence: low` | Same as above — treated as unreadable rather than shown with a caveat, to avoid agents trusting a low-confidence guess |
| Successful extraction | Editable field pre-filled with the code; agent confirms or corrects |

---

## 8. Acceptance Criteria

- Camera opens successfully when "Scan Pack Code" is tapped.
- A clearly printed code is extracted and displayed below the scanner within a few seconds.
- The displayed value is editable before the agent confirms it.
- An unreadable, blurry, or absent code results in a visible error state, not a blank or fabricated value.
- Camera permission denial is handled with a distinct, actionable message.
- Agent can retry capture without navigating away from the screen.

---

## 9. Risks

- **LLM OCR is not the same as barcode decoding.** This feature reads printed text, not the DotCode symbol. If any downstream requirement (e.g. anti-counterfeit verification against PMI's serialization system) needs the actual DotCode payload, this implementation will not satisfy it — flag this explicitly to the Marlboro stakeholders now to avoid a scope surprise later.
- **OCR misreads on damaged/reflective packaging.** Cigarette pack foil wrap is glossy and prone to glare; misreads are possible even at "high confidence." The editable-field-before-save step (FR6) is the main mitigation.
- **Cost/latency at scale.** Every scan is a network round trip plus an LLM call; if agents are scanning at high volume, monitor Gemini API cost and p95 latency.

---

## 10. Open Questions

1. Does any downstream system need to verify this code against PMI's track-and-trace database, or is it purely for record-keeping in InField? (Determines whether Section 9's DotCode risk needs to be resolved now or later.)
2. Do we need to retain the captured pack image for audit/compliance purposes, or is it discarded after extraction?
3. Auto-capture on focus lock vs. manual shutter — which does the field ops team prefer for one-handed use in the field?
4. What's the expected daily scan volume per agent, to size Gemini API cost/rate limits?

---

## 11. Out of Scope / Future Considerations

- True DotCode decoding via a dedicated barcode SDK (Dynamsoft/Scandit), if the raw dot-matrix payload is later required.
- Offline queuing of scans for later sync.
- Bulk/multi-pack scanning in a single session.
