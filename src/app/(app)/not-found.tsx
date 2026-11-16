import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card">
      <h1>404</h1>
      <p>પાનું મળ્યું નહીં. · Page not found.</p>
      <Link href="/dashboard">ડેશબોર્ડ</Link>
    </div>
  );
}
