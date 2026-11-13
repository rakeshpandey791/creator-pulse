export interface PasswordResetMailer {
  sendPasswordReset(message: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}

export class DevelopmentMailSink implements PasswordResetMailer {
  readonly messages: Array<{ to: string; token: string; expiresAt: Date }> = [];

  async sendPasswordReset(message: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    this.messages.push({ ...message });
  }
}

export class WebhookPasswordResetMailer implements PasswordResetMailer {
  constructor(private readonly webhookUrl: string) {}

  async sendPasswordReset(message: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      throw new Error(
        `Password reset mail adapter returned ${response.status}`,
      );
    }
  }
}
