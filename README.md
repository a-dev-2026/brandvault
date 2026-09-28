# BrandVault — Brand Kit & Asset Library Manager

BrandVault is a web application that enables teams to manage their brand profile (colors, logos, font presets) and an asset library with nested folder hierarchies, instant search, sorting, soft-delete trash recovery, and backend AI-powered asset tagging.

---

## 🚀 Live Demo & Credentials

- **Live App URL**: [https://brandvault-six.vercel.app](https://brandvault-six.vercel.app)
- **GitHub Repository**: [https://github.com/a-dev-2026/brandvault](https://github.com/a-dev-2026/brandvault)
- **Demo Account Login**:
  - **Email**: `demo@brandvault.dev`
  - **Password**: `Password123!`
  - *(Or sign up for a new account on `/signup` with Full Name, Email, and Password).*

---

## 🛠️ Stack Used

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) + TypeScript
- **Database & ORM**: PostgreSQL + [Prisma ORM 6](https://www.prisma.io/)
- **State & Data Fetching**: [TanStack Query v5](https://tanstack.com/query) + React Hook Form + Zod
- **Styling & Components**: Tailwind CSS + Shadcn UI / Radix UI + Lucide Icons + Sonner Toasts
- **GenAI Provider**: Groq API (`openai/gpt-oss-20b`) via OpenAI-compatible Chat Completions API
- **Testing**: Vitest unit test suite

---

## ⚡ Local Setup Instructions (Under 10 Commands)

```bash
# 1. Clone the repository
git clone https://github.com/a-dev-2026/brandvault.git && cd brandvault

# 2. Install dependencies
npm install

# 3. Copy environment configuration
cp .env.example .env

# 4. Push database schema to local PostgreSQL
npx prisma db push

# 5. Seed the database with sample demo data
npx prisma db seed

# 6. Run unit tests
npm test

# 7. Start local development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 📊 Data Model & Schema Overview

```
User (1) ──── (N) Workspace (1) ──┬── (1) Brand Profile
                                  ├── (N) Folders (Parent-Child Hierarchy)
                                  └── (N) Assets (Metadata & Soft Delete)
```

- **`User`**: Account authentication (`name`, `email`, `password` hash).
- **`Workspace`**: Scope of ownership for all data isolation.
- **`Brand`**: Brand identity (`name`, `primaryColor`, `secondaryColor`, `logoUrl`, `defaultFont`, `tagline`, `guidelines`).
- **`Folder`**: Self-referencing table (`parentId`) enabling nested folder trees up to 3 levels deep.
- **`Asset`**: Asset metadata (`name`, `type`, `url`, `size`, `mimeType`, `tags`, `aiTags`, `description`, `usageSuggestion`, `deletedAt`).

---

## 🔒 Authorization Rules in Plain English

1. **Strict Workspace Isolation**: Every mutating and query API route (`/api/brand`, `/api/folders`, `/api/assets`, `/api/assets/:id/ai-tags`) verifies the user's JWT session cookie.
2. **Scoped Database Queries**: Database queries are automatically constrained by `where: { workspaceId: session.workspaceId }`.
3. **Cross-Tenant Prevention**: Users cannot view, modify, move, or delete assets or folders belonging to another workspace, even if they guess valid asset IDs.
4. **Soft Delete Visibility**: Assets where `deletedAt != null` are hidden from normal library views and only visible in the `/trash` view.

---

## 🤖 GenAI Integration Details

- **AI Provider**: Groq API
- **Model**: `openai/gpt-oss-20b` (or configured `AI_MODEL`)
- **Backend Endpoint**: `POST /api/assets/:id/ai-tags`
- **Prompt Specification File**: [`prompts/asset-tagging.md`](./prompts/asset-tagging.md)
- **Validation Approach**:
  - The backend sends structured system prompts requesting raw JSON objects with `response_format: { type: "json_object" }`.
  - The JSON output is strictly parsed and validated against a **Zod schema** (`aiSuggestionSchema`).
  - If validation fails, the backend retries once with corrected prompt rules. Invalid outputs are never saved to the database automatically.
  - The user reviews, edits, and approves the generated tags/description before saving (`PATCH /api/assets/:id/ai-tags/save`).

---

## 🔗 n8n Webhook Integration (Optional Bonus Completed)

- **Exported Workflow File Path**: [`n8n/brandvault-webhook.json`](./n8n/brandvault-webhook.json)
- **Supported Webhook Events**:
  - `brand_updated`: Dispatched when the Brand Kit profile is saved or updated.
  - `asset_restored`: Dispatched when a soft-deleted asset is restored from Trash.
  - `ai_tags_saved`: Dispatched when an AI tag suggestion is reviewed and saved.
- **Payload Format**:
  ```json
  {
    "event": "ai_tags_saved",
    "resourceId": "cmuf_asset_id_123",
    "userEmail": "user@brandvault.dev",
    "timestamp": "2026-09-28T17:55:00.000Z",
    "data": { "name": "Hero Banner", "tagsCount": 5 }
  }
  ```
- **Configuration**: Set `N8N_WEBHOOK_URL` in your environment variables to enable automatic background event dispatching.

## ⚖️ Tradeoffs & Simplified Scope

- **Assets as Metadata**: Assets are stored as metadata records with external HTTPS URLs rather than multi-part S3 file uploads.
- **Folder Deletion**: Deleting a folder is blocked if the folder contains active assets or subfolders, preventing orphaned child assets.
- **Single Workspace per Account**: The app scopes all data to the primary workspace of the signed-in user without requiring a workspace switcher UI.

---

## 🔮 Next 3 Improvements

1. **Direct Cloud Storage Uploads**: Integrate AWS S3 or Supabase Storage with presigned upload URLs for drag-and-drop file uploads.
2. **Drag-and-Drop Folder Hierarchy**: Add interactive HTML5 drag-and-drop for moving assets between folders directly in the grid.
3. **Bulk Asset AI Tagging**: Allow users to select multiple assets and generate/review AI tags in batches.

---

## 📋 Submission Notes

- **Estimated Hours Spent**: ~12 hours
- **Hardest Technical Challenge**: Implementing recursive nested folder navigation with synchronized URL state (`?folder=<id>&q=&sort=`) and instant optimistic updates during soft deletes/restores.
