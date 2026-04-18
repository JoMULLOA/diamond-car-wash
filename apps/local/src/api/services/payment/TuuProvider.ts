import { IPaymentProvider, PaymentRequest, PaymentResponse, RemotePaymentRequest, WebhookResult } from './PaymentProvider';

export class TuuProvider implements IPaymentProvider {
  private apiKey: string;
  private endpoint = 'https://api.tuu.cl/api/v1'; // Generic endpoint based on Haulmer/TUU config

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createPayment(req: PaymentRequest): Promise<PaymentResponse> {
    if (!this.apiKey) {
      console.warn('[TuuProvider] No API Key provided, returning mock URL');
      return {
        paymentUrl: `https://checkout.tuu.cl/mock/${req.id}`,
        providerId: `tuu_mock_${Date.now()}`
      };
    }

    try {
      // Stub API request
      const response = await fetch(`${this.endpoint}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: req.amount,
          description: req.title,
          return_url: req.successUrl,
          webhook_url: req.successUrl, // using successUrl as a placeholder
          external_id: req.id
        })
      });

      if (!response.ok) {
        console.error('[TuuProvider] Error response:', await response.text());
        return { error: 'Failed to create TUU payment' };
      }

      const data = await response.json();
      return {
        paymentUrl: data.url || `https://checkout.tuu.cl/mock/${req.id}`,
        providerId: data.id || `tuu_${req.id}`
      };
    } catch (err: any) {
      console.error('[TuuProvider] Exception:', err.message);
      return { error: err.message };
    }
  }

  async triggerRemotePayment(req: RemotePaymentRequest): Promise<boolean> {
    console.log(`[TuuProvider] Triggering POST /pos/payment for terminal ${req.terminalId || 'default'} with amount ${req.amount}`);
    
    if (!this.apiKey) {
      console.log('[TuuProvider] Simulating POS payment success (No API key)');
      return true; // Simulate success
    }

    try {
      // POST to TUU Remote Payment API
      const response = await fetch(`${this.endpoint}/pos/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: req.amount,
          terminal_id: req.terminalId,
          external_id: req.id,
          print_receipt: true // Auto generate SII ticket
        })
      });

      if (!response.ok) {
        console.error('[TuuProvider] POS payment error:', await response.text());
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[TuuProvider] POS Exception:', err.message);
      return false;
    }
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    // Assuming TUU sends { status: 'PAID', external_id: '...', id: '...' }
    if (payload.status === 'PAID' || payload.status === 'APPROVED') {
      return { status: 'confirmed', providerId: payload.id, amountPaid: payload.amount };
    }
    return { status: 'ignored' };
  }
}
