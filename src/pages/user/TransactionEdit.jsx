// TransactionEdit — placeholder.
// Per Phase C6: backend gap B1 (PATCH /api/transactions/:id) is not yet
// shipped, so the form is blocked with a "Coming soon" surface. The route
// still resolves so links from TransactionDetail don't 404 — they show a
// clear notice pointing users back to the detail page.

import { Link, useParams } from 'react-router-dom'
import { Hammer, Lock } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'

export default function TransactionEdit() {
  const { id } = useParams()

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader title="Edit transaction" fallbackPath={`/transactions/${id}`} />

      <main className="flex-1" aria-label="Edit transaction">
        <Container variant="narrow" className="py-12">
          <Card padding="lg">
            <Stack gap={4} as="section">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-50">
                <Hammer className="h-6 w-6 text-warning-700" aria-hidden="true" />
              </div>

              <div className="text-center">
                <h1 className="text-h3 font-semibold text-text-primary">
                  Edit is coming soon
                </h1>
                <p className="mt-2 text-body-m text-text-secondary">
                  We&rsquo;re still wiring up transaction edits on the server. Until
                  then, you can view the full record from the detail page.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-caption text-text-tertiary">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Read-only mode
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link to={`/transactions/${id}`} className="block">
                  <GhostButton type="button" fullWidth>
                    ← Back to detail
                  </GhostButton>
                </Link>
              </div>
            </Stack>
          </Card>
        </Container>
      </main>

      <BottomTabBar />
    </div>
  )
}