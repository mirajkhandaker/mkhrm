import { redirect } from 'next/navigation';

// The former tabbed admin page has been split into dedicated routes
// (categories / locations / conditions / import) reachable directly from
// the sidebar. Anyone landing here from an older bookmark ends up on the
// inventory browser, which links out to each admin section.
export default function AssetsAdminRedirect() {
  redirect('/assets');
}
