import Link from "next/link";
import { Prompt } from "@/components/Prompt";

export default function NotFound() {
  return (
    <div className="wrap page-head">
      <Prompt command="analisis --path" />
      <h1>error: halaman tidak ditemukan (404)</h1>
      <p>
        <Link href="/">cd ~</Link>
      </p>
    </div>
  );
}
