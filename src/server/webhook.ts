export interface WebhookEventPayload {
  event: 'brand_updated' | 'asset_restored' | 'ai_tags_saved';
  resourceId: string;
  userEmail: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export function sendWebhookEvent(payload: WebhookEventPayload) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error('[Webhook Dispatch Error]:', err);
  });
}
