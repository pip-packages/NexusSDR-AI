# NEXUS-SDR | Autonomous AI Sales Agent

![Status](https://img.shields.io/badge/Status-Beta-blue)
![AI Model](https://img.shields.io/badge/AI-Gemini%202.5%20Pro%20%7C%203.0-purple)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Tailwind-teal)

**NEXUS-SDR** is an elite, autonomous Sales Development Representative platform. It executes end-to-end B2B sales outreach by combining deep prospect research, hyper-personalized multi-channel communication, intelligent conversation handling, and autonomous meeting booking.

Powered by **Google's Gemini 2.5 Pro and 3.0 Preview models**, NEXUS-SDR moves beyond simple templates to perform cognitive tasks previously reserved for human SDRs.

---

## 🧠 Cognitive Architecture

NEXUS-SDR operates using a multi-agent orchestrator system. It doesn't just "generate text"; it plans, critiques, and executes strategies.

| Agent / Module | Function | Model Used |
| :--- | :--- | :--- |
| **Orchestrator** | Plans the outreach execution path, deciding which tools to use and when. | Gemini 3.0 Flash |
| **Deep Researcher** | Scours the web for trigger events (funding, hiring, news) to create relevance. | Gemini 3.0 Pro |
| **Visual Analyst** | "Reads" website screenshots and videos to generate visual-based hooks. | Gemini 2.5 Pro (Vision) |
| **The Gatekeeper** | Scores leads (0-100) based on BANT (Budget, Authority, Need, Timing). | Gemini 3.0 Flash |
| **The Mirror** | Simulates the prospect to critique email drafts for tone and relevance ("Vibe Check"). | Gemini 3.0 Flash |
| **Logic Auditor** | Reviews the strategic reasoning behind a message before sending. | Gemini 3.0 Pro (Thinking) |
| **Competitor Intel** | Maps the buying committee and competitive landscape. | Gemini 3.0 Pro |

---

## 🚀 Key Features

### 1. Autonomous Prospecting & Enrichment
*   **BANT Scoring:** Automatically qualifies leads based on firmographics and inferred data.
*   **ICP Fit Analysis:** Grades prospects against your specific Ideal Customer Profile.
*   **Tech Stack Detection:** Identifies tools used by the prospect to tailor technical pitches.

### 2. Hyper-Personalized Outreach
*   **Visual Hooks:** Upload a screenshot of a prospect's website or a video clip; the AI analyzes design vibes and content to write hyper-specific openers.
*   **Microsite Generator:** Instantly builds personalized HTML microsites for high-value targets.
*   **Voice Blueprint:** Upload your previous writings/PDFs to clone your specific writing style and tone.

### 3. Strategic "War Room"
*   **Account Planning:** Analyze an entire company to find the "Power Center" and "Influence Paths."
*   **Battlecards:** Auto-generates competitive positioning and objection handling scripts specific to the account.

### 4. Intelligent Inbox
*   **Sentiment Analysis:** Detects intent (Interested, OOO, Not Interested, Hostile).
*   **Auto-Pilot:** Can autonomously draft and send replies for standard interactions.
*   **Escalation Router:** Detects sensitive situations (Legal threats, C-Suite engagement) and pauses automation for human handoff.

### 5. Logic Builder & Workflows
*   **Visual Sequencer:** Drag-and-drop logic for creating adaptive sales sequences (e.g., "If clicked link -> Call").
*   **Self-Correction:** The "SDR Coach" module critiques drafts and suggests A/B tests.

---

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS
*   **AI Engine:** `@google/genai` SDK (Gemini 1.5 Pro, 2.0 Flash, 3.0 Preview)
*   **Persistence:** LocalStorage (Primary) + Supabase (Optional Cloud Sync)
*   **Icons:** FontAwesome

---

## ⚡ Getting Started

### Prerequisites
*   Node.js (v18+)
*   A Google Cloud Project with the **Gemini API** enabled.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-org/nexus-sdr.git
    cd nexus-sdr
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

4.  **Run the application**
    ```bash
    npm run dev
    ```

### Configuration
1.  Navigate to the **Settings** tab.
2.  **Company Profile:** Enter your Value Proposition and Calendar Link.
3.  **Persona:** Define your SDR persona (e.g., "Consultative," "Professional").
4.  **Integrations:** (Optional) Add keys for Apollo, Hunter, HubSpot, or Salesforce to enable real data fetching.

---

## 🛡️ Safety & Compliance

NEXUS-SDR includes a **Compliance Layer** (`approvalService.ts`). It scans all outgoing messages for sensitive keywords (e.g., "guarantee," "legal," "discount") and restricts autonomous messaging to high-risk roles (e.g., CEO, Founder) unless explicitly approved.

---

## 🔮 Future Roadmap

*   Real-time Voice AI for autonomous cold calling.
*   Deep CRM bi-directional sync (Salesforce/HubSpot).
*   Multi-modal avatar generation for video outreach.

---
