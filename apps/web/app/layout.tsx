import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '../src/i18n';
import '../src/index.css';

export const metadata: Metadata = {
  title: 'Deck Design by Lobueno',
  icons: {
    icon: '/logo.svg',
    other: [{ rel: 'mask-icon', url: '/logo.svg', color: '#1a1a1a' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#f8f8f8',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
