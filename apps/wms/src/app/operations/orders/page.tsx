import { redirect } from 'next/navigation'

type SearchParamValue = string | string[] | undefined
type SearchParams = Record<string, SearchParamValue>

function serializeSearchParams(searchParams: SearchParams) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      params.set(key, value)
      continue
    }
    if (Array.isArray(value)) {
      value.forEach(entry => params.append(key, entry))
    }
  }
  return params.toString()
}

export default function OrdersRedirectPage({
  searchParams = {},
}: {
  searchParams?: SearchParams
}) {
  const queryString = serializeSearchParams(searchParams)
  const target = queryString
    ? `/operations/purchase-orders?${queryString}`
    : '/operations/purchase-orders'

  redirect(target)
}
