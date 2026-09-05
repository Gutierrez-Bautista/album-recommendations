import { requireAppAccess } from '@/lib/auth-guards'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await requireAppAccess()

  return children
}