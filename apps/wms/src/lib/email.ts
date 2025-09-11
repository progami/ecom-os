// Email service module
export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendEmail(_options: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<EmailResult> {
  // In production, this would use a real email service
  // For now, just return success
  // console.log('Sending email:', options)
  return { success: true, messageId: 'mock-message-id' }
}