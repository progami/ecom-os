import { redirect } from 'next/navigation'

export default function JasonAIPage() {
  const targetUrl =
    process.env.WMS_BASE_URL ||
    process.env.NEXT_PUBLIC_WMS_BASE_URL ||
    'https://ecomos.targonglobal.com/wms'

  redirect(targetUrl)
}
