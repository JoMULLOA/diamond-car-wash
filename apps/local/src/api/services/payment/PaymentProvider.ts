export interface PaymentRequest {
  id: string; // Booking or Item ID
  title: string;
  amount: number;
  currency?: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl?: string;
}

export interface PaymentResponse {
  paymentUrl?: string | null;
  providerId?: string | null;
  error?: string;
}

export interface WebhookResult {
  status: 'confirmed' | 'cancelled' | 'pending' | 'ignored';
  providerId?: string;
  amountPaid?: number;
}

export interface RemotePaymentRequest {
  id: string; // ID to track on our side
  amount: number;
  terminalId?: string; // which terminal to wake up
}

export interface IPaymentProvider {
  /** Creates an online checkout payment link */
  createPayment(req: PaymentRequest): Promise<PaymentResponse>;
  
  /** Triggers a physical POS terminal payment remotely */
  triggerRemotePayment(req: RemotePaymentRequest): Promise<boolean>;
  
  /** Validates and parses incoming webhooks from the provider */
  handleWebhook(payload: any, headers?: any): Promise<WebhookResult>;
}
