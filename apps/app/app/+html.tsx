import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { brand, darkColors, lightColors } from '@tendshare/ui';

/**
 * The HTML shell every web page is served inside.
 *
 * Two jobs. First, the icons a browser and an installed web app look for:
 * the web manifest, the touch icon and the app title — the manifest itself is a
 * static file in `public/`, because that is the one directory the web build
 * serves at the site root. Second, the page background, painted from the theme
 * tokens before React mounts so the app does not flash white on the way in,
 * in either colour scheme.
 *
 * It is web-only: Expo Router renders this file on web and ignores it on iOS
 * and Android, where the launch screen comes from `expo-splash-screen` instead.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content={brand.name} />
        <meta name="application-name" content={brand.name} />
        <style
          dangerouslySetInnerHTML={{
            __html: [
              `html,body{background-color:${lightColors.bg};}`,
              `@media (prefers-color-scheme: dark){html,body{background-color:${darkColors.bg};}}`,
            ].join(''),
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
