import { redirect } from 'next/navigation'

export default function JasonAIPage() {
  const targetUrl =
    process.env.TALOS_BASE_URL ||
    process.env.NEXT_PUBLIC_TALOS_BASE_URL ||
    process.env.WMS_BASE_URL ||
    process.env.NEXT_PUBLIC_WMS_BASE_URL ||
    'https://targon.targonglobal.com/talos'

  redirect(targetUrl)
}
