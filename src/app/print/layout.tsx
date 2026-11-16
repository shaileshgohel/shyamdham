// Printable documents render without the app's menu.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#e9ecf2", minHeight: "100vh", paddingBottom: 24 }}>{children}</div>;
}
