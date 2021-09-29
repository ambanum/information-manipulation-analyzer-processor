import {
  SendSmtpEmail,
  TransactionalEmailsApi,
  TransactionalEmailsApiApiKeys,
} from 'sib-api-v3-typescript';

export default class EmailNotifier {
  private smtpApi: TransactionalEmailsApi;
  constructor(apiKey) {
    this.smtpApi = new TransactionalEmailsApi();
    this.smtpApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);
  }

  public async sendNotification(options: SendSmtpEmail) {
    try {
      const response = await this.smtpApi.sendTransacEmail(options);

      return response?.body || [];
    } catch (err) {
      console.error(err.toString(), err?.response?.body?.message);
      return { messageId: null };
    }
  }
}
