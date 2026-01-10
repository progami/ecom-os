import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

function getRedirectUrl(pathname: string, searchParams: SearchParams) {
  const urlSearchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const entry of value) {
        urlSearchParams.append(key, entry)
      }
      continue
    }
    urlSearchParams.set(key, value)
  }

  const query = urlSearchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export default function StorageLedgerRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  redirect(getRedirectUrl('/operations/storage-ledger', searchParams))
}

