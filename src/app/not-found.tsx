import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="h1">Not found</h1>
      <p className="muted mt-2">This task or page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn-primary mt-4">
        Go to my day
      </Link>
    </div>
  );
}
