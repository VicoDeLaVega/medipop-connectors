import './globals.css';

export const metadata = {
  title: 'Medipop Admin',
  description: 'Read-only dashboard for synced Medipop prescriptions.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
