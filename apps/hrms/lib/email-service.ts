import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'HRMS <noreply@targonglobal.com>'
const HRMS_URL = process.env.NEXT_PUBLIC_HRMS_URL || 'https://ecomos.targonglobal.com/hrms'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY)
}

type EmailNotificationType =
  | 'POLICY_UPDATE'
  | 'VIOLATION_RECORDED'
  | 'VIOLATION_ACKNOWLEDGE_REQUIRED'
  | 'REVIEW_SUBMITTED'
  | 'HIERARCHY_CHANGED'
  | 'PROFILE_INCOMPLETE'
  | 'GENERAL'

const SUBJECT_MAP: Record<EmailNotificationType, string> = {
  POLICY_UPDATE: 'New Policy Update - Action Required',
  VIOLATION_RECORDED: 'Disciplinary Action Recorded - Acknowledgment Required',
  VIOLATION_ACKNOWLEDGE_REQUIRED: 'Violation Acknowledgment Required',
  REVIEW_SUBMITTED: 'Performance Review Submitted',
  HIERARCHY_CHANGED: 'Reporting Structure Changed',
  PROFILE_INCOMPLETE: 'Complete Your HRMS Profile',
  GENERAL: 'New HRMS Notification',
}

/**
 * Send email notification to user
 * Email does NOT contain the actual notification content for privacy/security
 * Just tells user to check HRMS
 */
export async function sendNotificationEmail(
  to: string,
  firstName: string,
  notificationType: EmailNotificationType,
  linkPath?: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.log(`[Email] Not configured. Would send to ${to}: ${SUBJECT_MAP[notificationType]}`)
    return { success: true }
  }

  const subject = SUBJECT_MAP[notificationType]
  const link = linkPath ? `${HRMS_URL}${linkPath}` : HRMS_URL

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">HRMS Notification</h1>
          </div>

          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Hi ${firstName},</p>

            <p>You have a new notification in HRMS that requires your attention.</p>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Notification Type</p>
              <p style="margin: 5px 0 0 0; font-weight: 600; color: #0f172a;">${subject.replace(' - Action Required', '').replace(' - Acknowledgment Required', '')}</p>
            </div>

            <a href="${link}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 10px;">
              View in HRMS
            </a>

            <p style="margin-top: 30px; font-size: 13px; color: #64748b;">
              For security reasons, notification details are not included in this email.
              Please log in to HRMS to view the full details.
            </p>
          </div>

          <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px;">
            This is an automated message from HRMS. Please do not reply to this email.
          </p>
        </body>
        </html>
      `,
    })

    console.log(`[Email] Sent to ${to}: ${subject}`)
    return { success: true }
  } catch (error: any) {
    console.error(`[Email] Failed to send to ${to}:`, error)
    return { success: false, error: error.message }
  }
}

/**
 * Send violation acknowledgment reminder
 */
export async function sendAcknowledgmentReminder(
  to: string,
  firstName: string,
  violationId: string,
  isManager: boolean
): Promise<{ success: boolean; error?: string }> {
  return sendNotificationEmail(
    to,
    firstName,
    'VIOLATION_ACKNOWLEDGE_REQUIRED',
    `/performance/disciplinary/${violationId}`
  )
}
