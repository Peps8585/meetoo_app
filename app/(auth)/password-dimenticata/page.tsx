import { Suspense } from 'react'
import PasswordDimenticataForm from './PasswordDimenticataForm'

// Il form legge ?error=link (arrivo da un link di recovery scaduto/non valido):
// useSearchParams richiede un boundary di Suspense per il prerender.
export default function PasswordDimenticataPage() {
  return (
    <Suspense>
      <PasswordDimenticataForm />
    </Suspense>
  )
}
