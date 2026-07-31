// AdminRecurring — placeholder.
// Per Phase I6: backend gap B4 (no /api/admin/recurring/* routes yet), so the
// page is blocked with a "Coming soon" surface. The route still resolves so
// direct navigation doesn't 404.

import { Hammer, Lock } from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'

export default function AdminRecurring() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar title="Recurring transactions" />

      <main className="flex-1" aria-label="Recurring transactions">
        <Container variant="narrow" className="py-12">
          <Card padding="lg">
            <Stack gap={4} as="section">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-50">
                <Hammer className="h-6 w-6 text-warning-700" aria-hidden="true" />
              </div>

              <div className="text-center">
                <h1 className="text-h3 font-semibold text-text-primary">
                  Recurring is coming soon
                </h1>
                <p className="mt-2 text-body-m text-text-secondary">
                  Recurring transactions aren&rsquo;t wired up to the backend yet. Once
                  the API ships, the rules list and authoring UI will appear here.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-caption text-text-tertiary">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Read-only mode
              </div>
            </Stack>
          </Card>
        </Container>
      </main>
    </div>
  )
}