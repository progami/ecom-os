import { redirect } from 'next/navigation'

export default function JasonAIPage() {
  const targetUrl = process.env.WMS_BASE_URL
  if (!targetUrl) {
    throw new Error('WMS_BASE_URL must be defined for the Jason redirect.')
  }

  redirect(targetUrl)
}
